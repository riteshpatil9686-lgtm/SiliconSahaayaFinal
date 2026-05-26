import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, CheckCircle, Clock, MapPin, Star, AlertTriangle, RotateCcw, Loader, Camera, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-900/20', icon: '📋' },
  ai_analyzed: { label: 'AI Analyzed', color: 'text-purple-400', bg: 'bg-purple-900/20', icon: '🤖' },
  assigned: { label: 'Department Assigned', color: 'text-yellow-400', bg: 'bg-yellow-900/20', icon: '🏢' },
  in_progress: { label: 'In Progress', color: 'text-orange-400', bg: 'bg-orange-900/20', icon: '⚙️' },
  field_inspection: { label: 'Field Inspection', color: 'text-cyan-400', bg: 'bg-cyan-900/20', icon: '🔍' },
  resolved: { label: 'Resolved', color: 'text-green-400', bg: 'bg-green-900/20', icon: '✅' },
  closed: { label: 'Closed', color: 'text-gray-400', bg: 'bg-gray-900/20', icon: '🔒' },
  escalated: { label: 'Escalated', color: 'text-red-400', bg: 'bg-red-900/20', icon: '🚨' },
  reopened: { label: 'Reopened', color: 'text-pink-400', bg: 'bg-pink-900/20', icon: '🔄' },
};

const TIMELINE_STEPS = ['submitted', 'ai_analyzed', 'assigned', 'in_progress', 'field_inspection', 'resolved'];

const StarRating = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(s => (
      <button key={s} onClick={() => onChange(s)} className={`text-2xl star ${s <= value ? 'text-saffron-400' : 'text-white/20'} hover:text-saffron-400 transition-colors`}>★</button>
    ))}
  </div>
);

const TrackComplaintPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const [searchId, setSearchId] = useState(searchParams.get('id') || '');
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [myComplaints, setMyComplaints] = useState([]);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopen, setShowReopen] = useState(false);

  // Auto-search if ID in URL
  useEffect(() => {
    if (searchParams.get('id')) fetchComplaint(searchParams.get('id'));
  }, []);

  // Load my complaints
  useEffect(() => {
    if (isAuthenticated) {
      api.get(`/complaints?user_id=${user?.id}&limit=10`).then(res => {
        setMyComplaints(res.data.complaints || []);
      }).catch(() => {});
    }
  }, [isAuthenticated, user]);

  const fetchComplaint = async (id) => {
    if (!id) return;
    setLoading(true);
    setComplaint(null);
    try {
      const res = await api.get(`/complaints/${id.trim().toUpperCase()}`);
      if (res.data.success) {
        setComplaint(res.data.complaint);
        setRating(res.data.complaint.citizen_rating || 0);
        setSearchParams({ id: id.trim().toUpperCase() });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Complaint not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchComplaint(searchId);
  };

  const submitRating = async () => {
    if (!rating) return toast.error('Please select a rating');
    setRatingSubmitting(true);
    try {
      await api.put(`/complaints/${complaint.id}/rate`, { rating, feedback });
      toast.success('Thank you for your feedback!');
      setComplaint(prev => ({ ...prev, citizen_rating: rating, citizen_feedback: feedback }));
    } catch {
      toast.error('Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason) return toast.error('Please provide a reason');
    try {
      await api.put(`/complaints/${complaint.id}/reopen`, { reason: reopenReason });
      toast.success('Complaint reopened');
      fetchComplaint(complaint.complaint_id);
    } catch {
      toast.error('Failed to reopen complaint');
    }
  };

  const currentStepIdx = complaint ? TIMELINE_STEPS.indexOf(complaint.status) : -1;

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="max-w-4xl mx-auto pt-6">
        <h1 className="text-3xl font-display font-bold text-white text-center mb-2">
          Track Your <span className="gradient-text">Complaint</span>
        </h1>
        <p className="text-white/60 text-center mb-8">Enter your Complaint ID (SS-YYYY-XXXXXX) to see real-time status</p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              className="input-field pl-10 text-base"
              placeholder="SS-2026-123456"
              value={searchId}
              onChange={e => setSearchId(e.target.value.toUpperCase())}
              pattern="SS-\d{4}-\d{6}"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {/* Complaint Details */}
        {complaint && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Card */}
            <div className="card p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="text-sm text-white/40 mb-1">Complaint ID</p>
                  <p className="text-2xl font-display font-bold text-saffron-400">{complaint.complaint_id}</p>
                  <h2 className="text-xl font-semibold text-white mt-2">{complaint.title}</h2>
                </div>
                <div className="text-right">
                  <span className={`status-badge status-${complaint.status}`}>
                    {STATUS_CONFIG[complaint.status]?.icon} {STATUS_CONFIG[complaint.status]?.label || complaint.status}
                  </span>
                  <p className="text-xs text-white/40 mt-2">{new Date(complaint.created_at).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {[
                  { label: 'Category', value: complaint.category },
                  { label: 'Urgency', value: complaint.urgency },
                  { label: 'Department', value: complaint.department_name || 'Pending' },
                  { label: 'Ward', value: complaint.ward_name || 'Bengaluru' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-forest-900/40 rounded-lg p-3">
                    <p className="text-xs text-white/40">{label}</p>
                    <p className="text-sm font-medium text-white capitalize">{value}</p>
                  </div>
                ))}
              </div>

              <p className="text-white/70 text-sm mt-4 leading-relaxed">{complaint.description}</p>

              {complaint.address && (
                <div className="flex items-start gap-2 mt-3 text-sm text-white/50">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-saffron-500" />
                  <span>{complaint.address}</span>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="card p-6">
              <h3 className="font-semibold text-white mb-5">Complaint Timeline</h3>
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-forest-700/50" />
                <div className="space-y-6">
                  {TIMELINE_STEPS.map((stepKey, idx) => {
                    const isDone = idx <= currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    const config = STATUS_CONFIG[stepKey];
                    const timelineEntry = complaint.timeline?.find(t => t.status === stepKey);

                    return (
                      <div key={stepKey} className="flex gap-4 relative">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10 transition-all ${
                          isDone ? 'bg-green-500/20 border-green-500 text-green-400' :
                          'bg-forest-900/50 border-forest-700 text-white/20'
                        } ${isCurrent ? 'animate-pulse-glow' : ''}`}>
                          <span className="text-lg">{isDone ? (isCurrent ? config?.icon : '✓') : config?.icon}</span>
                        </div>
                        <div className={`flex-1 pb-2 ${isDone ? '' : 'opacity-40'}`}>
                          <p className={`font-medium text-sm ${isDone ? 'text-white' : 'text-white/40'}`}>{config?.label}</p>
                          {timelineEntry && <p className="text-xs text-white/40 mt-1">{timelineEntry.description}</p>}
                          {timelineEntry && <p className="text-xs text-white/30 mt-1">{new Date(timelineEntry.created_at).toLocaleString('en-IN')}</p>}
                          {!timelineEntry && !isDone && <p className="text-xs text-white/20 mt-1">Pending</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ML Predictions */}
            {(complaint.priority_score || complaint.predicted_resolution_days) && (
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-lg">🤖</span> AI Analysis
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-saffron-400">{complaint.priority_score}</p>
                    <p className="text-xs text-white/40">Priority Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">{complaint.predicted_resolution_days}d</p>
                    <p className="text-xs text-white/40">Predicted ETA</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-400">
                      {complaint.ml_confidence ? Math.round(complaint.ml_confidence * 100) + '%' : 'N/A'}
                    </p>
                    <p className="text-xs text-white/40">AI Confidence</p>
                  </div>
                </div>
              </div>
            )}

            {/* Before / After Photos */}
            {complaint.images?.length > 0 && (() => {
              const before = complaint.images.filter(i => i.image_type === 'before');
              const after  = complaint.images.filter(i => i.image_type === 'after');
              return (
                <div className="card p-5">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-saffron-400" /> Before &amp; After Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Before Column */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-orange-400" />
                        <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Before</span>
                      </div>
                      {before.length > 0 ? (
                        <div className="space-y-2">
                          {before.map((img, i) => (
                            <div key={i} className="relative">
                              <img
                                src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${img.image_url}`}
                                alt="before"
                                className="w-full h-40 object-cover rounded-xl border-2 border-orange-500/30"
                                onError={e => e.target.src = 'https://via.placeholder.com/300x200/1a4731/ffffff?text=Before'}
                              />
                              <span className="absolute bottom-2 left-2 text-xs bg-orange-600/80 text-white px-2 py-0.5 rounded">
                                {new Date(img.created_at).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="w-full h-40 rounded-xl border-2 border-dashed border-forest-700 flex items-center justify-center">
                          <span className="text-xs text-white/30">No before photo</span>
                        </div>
                      )}
                    </div>

                    {/* After Column */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">After</span>
                      </div>
                      {after.length > 0 ? (
                        <div className="space-y-2">
                          {after.map((img, i) => (
                            <div key={i} className="relative">
                              <img
                                src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${img.image_url}`}
                                alt="after"
                                className="w-full h-40 object-cover rounded-xl border-2 border-green-500/30"
                                onError={e => e.target.src = 'https://via.placeholder.com/300x200/1a4731/ffffff?text=After'}
                              />
                              <span className="absolute bottom-2 left-2 text-xs bg-green-600/80 text-white px-2 py-0.5 rounded">
                                ✓ {new Date(img.created_at).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="w-full h-40 rounded-xl border-2 border-dashed border-forest-700 flex flex-col items-center justify-center gap-1">
                          <Camera className="w-5 h-5 text-white/20" />
                          <span className="text-xs text-white/30 text-center">
                            {complaint.status === 'resolved' ? 'After photo not uploaded' : 'Pending work completion'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress indicator */}
                  {before.length > 0 && after.length > 0 && (
                    <div className="mt-4 flex items-center gap-3 bg-green-900/20 border border-green-500/20 rounded-xl px-4 py-3">
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      <p className="text-sm text-green-300">Work completed — before &amp; after photos verified.</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Resolution */}
            {complaint.resolution && (
              <div className="card p-5 border-green-500/30">
                <h3 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Resolution Details
                </h3>
                <p className="text-white/80 text-sm">{complaint.resolution.resolution_description}</p>
                {complaint.resolution.action_taken && (
                  <p className="text-white/60 text-sm mt-2">Action taken: {complaint.resolution.action_taken}</p>
                )}
              </div>
            )}

            {/* Rating */}
            {complaint.status === 'resolved' && (
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3">Rate Your Experience</h3>
                {complaint.citizen_rating ? (
                  <div>
                    <div className="flex gap-1 mb-2">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-2xl ${s <= complaint.citizen_rating ? 'text-saffron-400' : 'text-white/20'}`}>★</span>
                      ))}
                    </div>
                    {complaint.citizen_feedback && <p className="text-sm text-white/60">"{complaint.citizen_feedback}"</p>}
                    <p className="text-xs text-white/30 mt-2">Thank you for your feedback!</p>
                  </div>
                ) : (
                  <div>
                    <StarRating value={rating} onChange={setRating} />
                    <textarea
                      className="input-field mt-3"
                      rows={2}
                      placeholder="Optional: Tell us about your experience..."
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                    />
                    <button onClick={submitRating} disabled={ratingSubmitting} className="btn-primary mt-3">
                      {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reopen */}
            {['resolved', 'closed'].includes(complaint.status) && isAuthenticated && (
              <div className="card p-5">
                <button onClick={() => setShowReopen(!showReopen)} className="flex items-center gap-2 text-saffron-400 hover:text-saffron-300 text-sm font-medium">
                  <RotateCcw className="w-4 h-4" />
                  Not satisfied? Reopen complaint
                </button>
                {showReopen && (
                  <div className="mt-3 space-y-3 animate-fade-in">
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Reason for reopening..."
                      value={reopenReason}
                      onChange={e => setReopenReason(e.target.value)}
                    />
                    <button onClick={handleReopen} className="btn-primary">
                      <RotateCcw className="w-4 h-4" /> Reopen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* My Complaints */}
        {isAuthenticated && myComplaints.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold text-white mb-4">My Recent Complaints</h2>
            <div className="space-y-3">
              {myComplaints.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSearchId(c.complaint_id); fetchComplaint(c.complaint_id); }}
                  className="card w-full p-4 text-left hover:border-saffron-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-saffron-400 text-sm">{c.complaint_id}</p>
                      <p className="text-white/80 text-sm mt-0.5">{c.title}</p>
                      <p className="text-white/40 text-xs mt-1">{c.category} · {new Date(c.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-badge status-${c.status} text-xs`}>{c.status}</span>
                      <ChevronRight className="w-4 h-4 text-white/30" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackComplaintPage;
