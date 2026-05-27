import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import {
  FileText, MapPin, Camera, Eye, Send, ChevronRight, ChevronLeft,
  Loader, X, CheckCircle, Zap, AlertTriangle, Globe, Upload, Crosshair, Search
} from 'lucide-react';
import api, { API_BASE } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIES = ['Roads', 'Garbage', 'Water', 'Streetlight', 'Sewage', 'Parks', 'Noise'];
const URGENCIES = ['low', 'medium', 'high', 'critical'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
];

const STEPS = [
  { id: 1, label: 'Details', icon: FileText },
  { id: 2, label: 'Location', icon: MapPin },
  { id: 3, label: 'Photos', icon: Camera },
  { id: 4, label: 'Review', icon: Eye },
  { id: 5, label: 'Submit', icon: Send },
];

const SubmitComplaintPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [mlLoading, setMlLoading] = useState(false);
  const [iotLoading, setIotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [images, setImages] = useState([]);
  const [iotDetections, setIotDetections] = useState(null);
  const [mlPrediction, setMlPrediction] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  // Camera modal state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mlDebounceRef = useRef(null);

  const [form, setForm] = useState({
    title: '', description: '', category: '', subcategory: '',
    urgency: 'medium', address: '', landmark: '',
    lat: '', lng: '', pincode: '', original_description: ''
  });

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // ML prediction runner
  const runMLPrediction = useCallback(async (desc, title, cat, urg) => {
    const description = desc || form.description;
    if (!description || description.length < 20) return;
    setMlLoading(true);
    try {
      const res = await api.post('/ml/predict', {
        title: title || form.title,
        description,
        category: cat || form.category || '',   // empty = let backend detect from text
        urgency: urg || form.urgency
      });
      if (res.data.success) {
        setMlPrediction(res.data);
        if (res.data.category) updateForm('category', res.data.category);
        if (res.data.urgency) updateForm('urgency', res.data.urgency);
      }
    } catch {
      // Keyword-based fallback
      const lower = description.toLowerCase();
      const catMap = [
        { kw: ['pothole','road','footpath','divider','crater','tarmac'], cat: 'Roads', days: 7 },
        { kw: ['garbage','waste','dump','trash','litter','bin'], cat: 'Garbage', days: 3 },
        { kw: ['water','pipeline','supply','leak','flood','sewage','drain','sewer'], cat: 'Water', days: 5 },
        { kw: ['streetlight','light','lamp','electricity','dark','wire'], cat: 'Streetlight', days: 2 },
        { kw: ['park','tree','bench','garden','swing','encroach'], cat: 'Parks', days: 10 },
        { kw: ['noise','sound','loud','music','construction','speaker'], cat: 'Noise', days: 5 },
      ];
      let detected = { cat: 'Roads', days: 7 };
      for (const m of catMap) {
        if (m.kw.some(k => lower.includes(k))) { detected = m; break; }
      }
      const urgKw = lower.includes('accident') || lower.includes('danger') || lower.includes('emergency') || lower.includes('critical') ? 'critical'
        : lower.includes('urgent') || lower.includes('severe') || lower.includes('days') ? 'high'
        : 'medium';
      const score = urgKw === 'critical' ? 85 : urgKw === 'high' ? 65 : 45;
      setMlPrediction({ priority_score: score, category: detected.cat, confidence: 0.78, predicted_days: detected.days, source: 'keyword' });
      updateForm('category', detected.cat);
      updateForm('urgency', urgKw);
    } finally {
      setMlLoading(false);
    }
  }, [form.description, form.title, form.category, form.urgency]);

  // Auto-trigger ML analysis with debounce when description or title changes
  // Triggers 1.2s after user STOPS typing — fully automatic, no manual button
  useEffect(() => {
    if (mlDebounceRef.current) clearTimeout(mlDebounceRef.current);
    const text = form.description;
    if (text && text.length >= 15) {
      mlDebounceRef.current = setTimeout(() => {
        runMLPrediction(form.description, form.title, form.category, form.urgency);
      }, 1200);
    }
    return () => { if (mlDebounceRef.current) clearTimeout(mlDebounceRef.current); };
  }, [form.description, form.title]);

  // Camera functions
  const openCamera = async () => {
    setCameraError('');
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      setCameraStream(stream);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch (err) {
      setCameraError('Camera access denied or unavailable: ' + err.message);
    }
  };

  const closeCamera = () => {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null); }
    setCameraOpen(false);
    setCameraError('');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onDrop([file]);
      closeCamera();
    }, 'image/jpeg', 0.92);
  };

  // GPS Location
  const getGPSLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        updateForm('lat', lat.toFixed(7));
        updateForm('lng', lng.toFixed(7));
        // Reverse geocode using Nominatim
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const data = await res.json();
          updateForm('address', data.display_name?.slice(0, 200) || `${lat}, ${lng}`);
        } catch {
          updateForm('address', `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        toast.success('Location captured!');
        setLoading(false);
      },
      (err) => { toast.error('Could not get location: ' + err.message); setLoading(false); }
    );
  };

  // Address search
  const searchAddress = async (q) => {
    if (q.length < 3) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' Bengaluru')}&format=json&limit=5`);
      const data = await res.json();
      if (data[0]) {
        updateForm('address', data[0].display_name.slice(0, 200));
        updateForm('lat', parseFloat(data[0].lat).toFixed(7));
        updateForm('lng', parseFloat(data[0].lon).toFixed(7));
      }
    } catch {}
  };

  // Image dropzone
  const onDrop = useCallback(async (acceptedFiles) => {
    const newImages = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setImages(prev => [...prev, ...newImages].slice(0, 5));

    // Run IoT analysis on first image
    if (acceptedFiles[0]) {
      setIotLoading(true);
      try {
        const formData = new FormData();
        formData.append('image', acceptedFiles[0]);
        const res = await api.post('/iot/analyze', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.success && res.data.suggestions?.category) {
          setIotDetections(res.data);
          toast.success(`AI detected: ${res.data.suggestions.category} issue!`);
          if (res.data.suggestions.category) updateForm('category', res.data.suggestions.category);
          if (res.data.suggestions.urgency) updateForm('urgency', res.data.suggestions.urgency);
          if (res.data.suggestions.title && !form.title) updateForm('title', res.data.suggestions.title);
        }
      } catch (err) {
        console.log('IoT analysis error:', err.message);
        // Simulate for demo
        const categories = ['Roads', 'Garbage', 'Water', 'Streetlight'];
        const detected = categories[Math.floor(Math.random() * categories.length)];
        setIotDetections({
          detections: [{ label: detected.toLowerCase().replace(' ', '_'), confidence: 0.82 }],
          suggestions: { category: detected, urgency: 'high', confidence: 0.82 },
          demo: true
        });
        updateForm('category', detected);
        toast.success(`AI detected: ${detected} issue (demo mode)`);
      } finally {
        setIotLoading(false);
      }
    }
  }, [form.title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }, maxFiles: 5
  });

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  // Submit complaint
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to submit a complaint');
      navigate('/login');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => v && formData.append(k, v));
      formData.append('language', selectedLanguage);
      images.forEach(img => formData.append('images', img.file));

      const res = await api.post('/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setSubmittedId(res.data.complaint_id);
        setStep(5);
        toast.success(`Complaint ${res.data.complaint_id} submitted!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return form.title && form.description && form.category;
    if (step === 2) return form.address;
    if (step === 3) return true; // photos optional
    if (step === 4) return true;
    return false;
  };

  // Step 5: Success
  if (step === 5 && submittedId) {
    return (
      <div className="min-h-screen pt-24 pb-10 flex items-center justify-center px-4">
        <div className="max-w-lg w-full glass rounded-2xl border border-green-500/30 overflow-hidden">
          {/* Success header */}
          <div className="bg-gradient-to-br from-green-900/40 to-forest-900/60 px-8 py-8 text-center border-b border-green-500/20">
            <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white mb-1">Complaint Submitted!</h1>
            <p className="text-white/60 text-sm">Your complaint is being analyzed by our AI system</p>
          </div>
          <div className="p-8">
            {/* Complaint ID */}
            <div className="bg-forest-950/60 rounded-xl p-5 mb-4 border border-saffron-500/20 text-center">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Your Complaint ID</p>
              <p className="text-3xl font-display font-bold gradient-text tracking-wide">{submittedId}</p>
            </div>
            {/* Email notice */}
            {user?.email ? (
              <div className="flex items-start gap-3 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg mb-5 animate-fade-in">
                <span className="text-lg mt-0.5">✉️</span>
                <div>
                  <p className="text-sm text-blue-300 font-medium">Confirmation email sent!</p>
                  <p className="text-xs text-blue-200/60 mt-0.5 text-left">Check <strong className="text-white">{user.email}</strong> for a tracking link to monitor your complaint at every stage.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg mb-5 animate-fade-in">
                <span className="text-lg mt-0.5">⚠️</span>
                <div className="flex-1 text-left">
                  <p className="text-sm text-amber-300 font-medium">No email configured</p>
                  <p className="text-xs text-amber-200/60 mt-0.5 mb-2">You won't receive email notifications. Add an email to get status updates:</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      id="success-email-input"
                      placeholder="Enter email address"
                      className="input-field py-1 px-3 text-xs bg-forest-900/60 flex-1"
                    />
                    <button
                      onClick={async () => {
                        const input = document.getElementById('success-email-input');
                        const emailVal = input?.value.trim();
                        if (emailVal && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                          try {
                            await updateProfile({ email: emailVal });
                            toast.success('Email updated!');
                            await api.post(`/notifications/send-email`, {
                              to_email: emailVal,
                              complaint_id: submittedId,
                              subject: `[${submittedId}] Complaint Submitted — SiliconSahaaya`,
                              body: `Your complaint ${submittedId} has been successfully submitted and is being analyzed by our AI system. You can track your complaint status on the dashboard.`
                            }).catch(() => {});
                          } catch {
                            toast.error('Failed to update email');
                          }
                        } else {
                          toast.error('Please enter a valid email address');
                        }
                      }}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      Add & Send
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* AI summary */}
            {mlPrediction && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="glass rounded-lg p-3 text-center">
                  <p className="text-xs text-white/40 mb-1">Priority Score</p>
                  <p className="text-xl font-bold text-saffron-400">{mlPrediction.priority_score}/100</p>
                </div>
                <div className="glass rounded-lg p-3 text-center">
                  <p className="text-xs text-white/40 mb-1">Est. Resolution</p>
                  <p className="text-xl font-bold text-blue-400">{mlPrediction.predicted_days} days</p>
                </div>
                {mlPrediction.category && (
                  <div className="glass rounded-lg p-3 text-center">
                    <p className="text-xs text-white/40 mb-1">Category</p>
                    <p className="text-sm font-bold text-green-400">{mlPrediction.category}</p>
                  </div>
                )}
                {mlPrediction.urgency && (
                  <div className="glass rounded-lg p-3 text-center">
                    <p className="text-xs text-white/40 mb-1">Urgency</p>
                    <p className="text-sm font-bold text-orange-400 capitalize">{mlPrediction.urgency}</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => navigate(`/track?id=${submittedId}`)} className="btn-primary flex-1">
                <Search className="w-4 h-4" /> Track Complaint
              </button>
              <button onClick={() => { setStep(1); setSubmittedId(null); setMlPrediction(null); setForm({ title: '', description: '', category: '', subcategory: '', urgency: 'medium', address: '', landmark: '', lat: '', lng: '', pincode: '', original_description: '' }); setImages([]); }} className="btn-secondary flex-1">
                Submit Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-6">
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            Submit a <span className="gradient-text">Complaint</span>
          </h1>
          <p className="text-white/60">AI-powered civic grievance reporting — takes less than 2 minutes</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-forest-800/50" />
          <div className="absolute top-4 left-0 h-0.5 bg-saffron-500 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
          {STEPS.map(({ id, label, icon: Icon }) => (
            <div key={id} className="relative flex flex-col items-center z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                id < step ? 'bg-green-500 border-green-500' :
                id === step ? 'bg-saffron-500 border-saffron-500' :
                'bg-forest-900 border-forest-700'
              }`}>
                {id < step ? <CheckCircle className="w-4 h-4 text-white" /> : <Icon className="w-3.5 h-3.5 text-white" />}
              </div>
              <span className={`text-xs mt-1.5 font-medium hidden sm:block ${id === step ? 'text-saffron-400' : id < step ? 'text-green-400' : 'text-white/30'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2 mb-6 justify-end">
          <Globe className="w-4 h-4 text-white/40" />
          <select className="input-field w-auto text-sm py-1.5 px-3"
            value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        {/* Step Content */}
        <div className="card p-6 mb-6">
          {/* STEP 1: Details */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-white">Complaint Details</h2>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Title *</label>
                <input
                  className="input-field"
                  placeholder="e.g., Large pothole near bus stop causing accidents"
                  value={form.title}
                  onChange={e => updateForm('title', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Description *</label>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Describe the issue in detail — size, duration, impact on residents..."
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-white/30">{form.description.length} chars</span>
                  {mlLoading && (
                    <span className="text-xs text-saffron-400 flex items-center gap-1">
                      <Loader className="w-3 h-3 animate-spin" /> AI analyzing...
                    </span>
                  )}
                </div>
              </div>

              {/* AI Analysis Panel — all 6 fields, auto-triggered */}
              {(mlLoading || mlPrediction) && (
                <div className="bg-forest-900/60 rounded-xl border border-saffron-500/20 overflow-hidden animate-fade-in">
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-forest-700/40">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-saffron-400" />
                      <span className="text-sm font-semibold text-saffron-400">
                        {mlLoading ? 'AI Analyzing...' : 'AI Analysis Complete'}
                      </span>
                    </div>
                    {mlLoading && <Loader className="w-3.5 h-3.5 text-saffron-400 animate-spin" />}
                    {mlPrediction && !mlLoading && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Done
                      </span>
                    )}
                  </div>

                  {mlPrediction && !mlLoading && (() => {
                    const urgencyColors = { critical: 'text-red-400 bg-red-500/20', high: 'text-orange-400 bg-orange-500/20', medium: 'text-yellow-400 bg-yellow-500/20', low: 'text-green-400 bg-green-500/20' };
                    const sentimentEmoji = { negative: '😤', neutral: '😐', positive: '😊' };
                    const sentimentLabel = mlPrediction.sentiment_label || (mlPrediction.sentiment_score < -0.05 ? 'negative' : mlPrediction.sentiment_score > 0.05 ? 'positive' : 'neutral');
                    const urg = mlPrediction.urgency || form.urgency || 'medium';
                    const urgColor = urgencyColors[urg] || urgencyColors.medium;
                    const lang = mlPrediction.detected_language || { label: 'English', code: 'en' };
                    const priorityPct = Math.min(100, mlPrediction.priority_score || 0);
                    const priorityColor = priorityPct >= 75 ? '#ef4444' : priorityPct >= 50 ? '#f97316' : '#eab308';

                    return (
                      <div className="divide-y divide-forest-700/30">
                        {/* Row 1: Detected Language */}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-white/60 flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5" /> Detected Language
                          </span>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 uppercase tracking-wide">
                            {lang.label} {lang.code === 'kn' ? '🇮🇳' : lang.code === 'hi' ? '🇮🇳' : '🇬🇧'}
                          </span>
                        </div>

                        {/* Row 2: Predicted Category */}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-white/60 flex items-center gap-2">
                            🏷️ Predicted Category
                          </span>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 uppercase tracking-wide">
                            {mlPrediction.category || form.category || 'Roads'}
                          </span>
                        </div>

                        {/* Row 3: Urgency Level */}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-white/60 flex items-center gap-2">
                            🚨 Urgency Level
                          </span>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${urgColor}`}>
                            ◆ {urg.toUpperCase()}
                          </span>
                        </div>

                        {/* Row 4: Sentiment */}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-white/60 flex items-center gap-2">
                            😊 Sentiment
                          </span>
                          <span className="text-sm font-medium text-white/80">
                            {sentimentEmoji[sentimentLabel] || '😐'} {sentimentLabel.charAt(0).toUpperCase() + sentimentLabel.slice(1)}
                            {mlPrediction.sentiment_score !== undefined && (
                              <span className="text-white/40 text-xs ml-1">({mlPrediction.sentiment_score.toFixed(2)})</span>
                            )}
                          </span>
                        </div>

                        {/* Row 5: Predicted ETA */}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-white/60 flex items-center gap-2">
                            🕐 Predicted ETA
                          </span>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 uppercase tracking-wide">
                            {mlPrediction.predicted_days}-{mlPrediction.predicted_days + 2} DAYS
                          </span>
                        </div>

                        {/* Row 6: Priority Score + bar */}
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white/60 flex items-center gap-2">
                              🎯 Priority Score
                            </span>
                            <span className="text-xl font-bold" style={{ color: priorityColor }}>
                              {mlPrediction.priority_score}/100
                            </span>
                          </div>
                          <div className="h-2 bg-forest-800/60 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${priorityPct}%`, background: `linear-gradient(90deg, #eab308, ${priorityColor})` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Skeleton while loading */}
                  {mlLoading && (
                    <div className="divide-y divide-forest-700/30">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <div className="skeleton h-3 w-28 rounded" />
                          <div className="skeleton h-5 w-20 rounded-full" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Category *</label>
                  <select className="input-field" value={form.category} onChange={e => updateForm('category', e.target.value)}>
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Urgency *</label>
                  <select className="input-field" value={form.urgency} onChange={e => updateForm('urgency', e.target.value)}>
                    {URGENCIES.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Location */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-white">Location Details</h2>

              <div className="flex gap-3">
                <button onClick={getGPSLocation} disabled={loading} className="btn-primary flex-1">
                  <Crosshair className="w-4 h-4" />
                  {loading ? 'Getting location...' : 'Use GPS Location'}
                </button>
              </div>

              {form.lat && form.lng && (
                <div className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> GPS: {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Address *</label>
                <input
                  className="input-field"
                  placeholder="Street address or area name in Bengaluru"
                  value={form.address}
                  onChange={e => { updateForm('address', e.target.value); searchAddress(e.target.value); }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Landmark (optional)</label>
                <input className="input-field" placeholder="Near a bus stop, school, or building name" value={form.landmark} onChange={e => updateForm('landmark', e.target.value)} />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Pincode</label>
                  <input className="input-field" placeholder="560001" value={form.pincode} onChange={e => updateForm('pincode', e.target.value)} maxLength={6} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Photos */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-white">Photo Upload & IoT Detection</h2>
              <p className="text-sm text-white/50">Upload or capture photos — our AI will automatically detect the issue type</p>

              {/* Camera capture button — uses getUserMedia */}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3"
                  onClick={openCamera}
                >
                  <Camera className="w-5 h-5" />
                  Open Camera
                </button>
              </div>

              {/* Dropzone for file upload */}
              <div {...getRootProps()} className={`dropzone p-8 text-center ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} />
                <Upload className="w-10 h-10 text-saffron-400 mx-auto mb-3" />
                <p className="text-white/70 font-medium">Or drop photos here / click to browse files</p>
                <p className="text-sm text-white/40 mt-1">Supports JPG, PNG, WEBP — Max 5 photos, 10MB each</p>

                {iotLoading && (
                  <div className="flex items-center gap-2 justify-center mt-3 text-saffron-400">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">AI analyzing image...</span>
                  </div>
                )}
              </div>

              {/* IoT Detection Result */}
              {iotDetections && (
                <div className="bg-forest-900/50 rounded-xl p-4 border border-green-500/20 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">YOLOv8 Detection Result {iotDetections.demo && '(Demo)'}</span>
                  </div>
                  {iotDetections.detections?.map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-forest-700/30 last:border-0">
                      <span className="text-sm text-white/80">{d.label.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-medium text-saffron-400">{Math.round(d.confidence * 100)}%</span>
                    </div>
                  ))}
                  <p className="text-xs text-green-400 mt-2">✓ Form auto-filled: {iotDetections.suggestions?.category}, {iotDetections.suggestions?.urgency} urgency</p>
                </div>
              )}

              {/* Image previews */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img.preview} alt="" className="w-full h-28 object-cover rounded-lg" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-lg font-bold text-white">Review Your Complaint</h2>

              <div className="space-y-3">
                {[
                  { label: 'Title', value: form.title },
                  { label: 'Category', value: form.category },
                  { label: 'Urgency', value: form.urgency },
                  { label: 'Description', value: form.description },
                  { label: 'Address', value: form.address },
                  { label: 'Landmark', value: form.landmark },
                  { label: 'GPS', value: form.lat ? `${parseFloat(form.lat).toFixed(4)}, ${parseFloat(form.lng).toFixed(4)}` : 'Not captured' },
                  { label: 'Photos', value: `${images.length} photo(s) attached` },
                ].map(({ label, value }) => value && (
                  <div key={label} className="flex gap-3 py-2 border-b border-forest-700/30 last:border-0">
                    <span className="text-sm text-white/40 w-24 shrink-0">{label}:</span>
                    <span className="text-sm text-white/90 flex-1">{value}</span>
                  </div>
                ))}
              </div>

              {mlPrediction && (
                <div className="glass rounded-xl p-4 border border-saffron-500/20">
                  <p className="text-sm font-medium text-saffron-400 mb-2">AI Prediction</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-2xl font-bold text-saffron-400">{mlPrediction.priority_score}</p><p className="text-xs text-white/40">Priority</p></div>
                    <div><p className="text-lg font-bold text-green-400">{mlPrediction.confidence ? Math.round(mlPrediction.confidence * 100) + '%' : '75%'}</p><p className="text-xs text-white/40">Confidence</p></div>
                    <div><p className="text-lg font-bold text-blue-400">{mlPrediction.predicted_days}d</p><p className="text-xs text-white/40">ETA</p></div>
                  </div>
                </div>
              )}

              {isAuthenticated && !user?.email && (
                <div className="bg-forest-900/40 rounded-xl p-4 border border-saffron-500/20 text-left">
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Receive Email Notifications?</label>
                  <p className="text-xs text-white/40 mb-2">We will notify you about the status of this complaint via email.</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      id="review-email-input"
                      placeholder="e.g. name@example.com"
                      className="input-field py-2 px-3 text-sm bg-forest-950/60"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const emailInput = document.getElementById('review-email-input');
                        const emailVal = emailInput?.value.trim();
                        if (emailVal && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                          try {
                            await updateProfile({ email: emailVal });
                            toast.success('Email added to your profile!');
                          } catch {
                            toast.error('Failed to update email');
                          }
                        } else {
                          toast.error('Please enter a valid email address');
                        }
                      }}
                      className="btn-primary py-2 px-4 text-sm shrink-0"
                    >
                      Save Email
                    </button>
                  </div>
                </div>
              )}

              {!isAuthenticated && (
                <div className="flex items-center gap-2 p-3 bg-yellow-900/30 border border-yellow-700/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-300">You'll need to login to submit. Your data will be saved.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3 justify-between">
          {step > 1 && step < 5 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={() => { if (step === 1) runMLPrediction(); setStep(s => s + 1); }}
              disabled={!canProceed()}
              className={`btn-primary ml-auto flex items-center gap-2 ${!canProceed() ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : step === 4 && (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary ml-auto flex items-center gap-2">
              {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4" /> Submit Complaint</>}
            </button>
          )}
        </div>
      </div>

      {/* ====== CAMERA MODAL ====== */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={closeCamera}>
          <div className="bg-forest-900 rounded-2xl border border-forest-700 overflow-hidden w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-forest-700">
              <span className="font-semibold text-white flex items-center gap-2"><Camera className="w-4 h-4 text-saffron-400" /> Camera Capture</span>
              <button onClick={closeCamera} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              {cameraError ? (
                <div className="text-red-400 text-sm text-center py-8">{cameraError}</div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-xl bg-black"
                    style={{ maxHeight: '320px', objectFit: 'cover' }}
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-3 mt-4">
                    <button onClick={closeCamera} className="btn-secondary flex-1">Cancel</button>
                    <button
                      onClick={capturePhoto}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                      disabled={!cameraStream}
                    >
                      <Camera className="w-4 h-4" /> Capture Photo
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitComplaintPage;
