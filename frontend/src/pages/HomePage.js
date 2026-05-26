import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FileText, Search, Bot, Map, BarChart3, Shield, Bell, Camera,
  Smartphone, Award, ChevronRight, ArrowRight, Zap, Clock, CheckCircle,
  AlertTriangle, TrendingUp, Users, Activity
} from 'lucide-react';
import api from '../utils/api';

// Animated counter
const AnimatedCounter = ({ end, duration = 2000, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const step = end / (duration / 16);
        let current = 0;
        const timer = setInterval(() => {
          current = Math.min(current + step, end);
          setCount(Math.floor(current));
          if (current >= end) clearInterval(timer);
        }, 16);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

// Map pin urgency colors
const URGENCY_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

const HomePage = () => {
  const [stats, setStats] = useState({
    total_complaints: 0, resolved: 0, today_submitted: 0, today_resolved: 0,
    avg_satisfaction: 0
  });
  const [mapComplaints, setMapComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/complaints/stats'),
      api.get('/complaints/map')
    ]).then(([statsRes, mapRes]) => {
      if (statsRes.data.stats) {
        const s = statsRes.data.stats;
        // Normalize field names from backend
        setStats({
          total_complaints: parseInt(s.total || s.total_complaints) || 0,
          resolved: parseInt(s.resolved) || 0,
          today_submitted: parseInt(s.today_submitted) || 0,
          today_resolved: parseInt(s.today_resolved) || 0,
          avg_satisfaction: parseFloat(s.avg_satisfaction) || 0,
        });
      }
      if (mapRes.data.complaints) setMapComplaints(mapRes.data.complaints);
    }).catch(() => {
      setStats({ total_complaints: 0, resolved: 0, today_submitted: 0, today_resolved: 0, avg_satisfaction: 0 });
      setMapComplaints([]);
    }).finally(() => setLoading(false));
  }, []);

  const features = [
    { icon: FileText, title: 'Smart Complaint Submission', desc: 'AI auto-detects category and urgency from your description. Step-by-step 5-stage wizard.', to: '/submit', color: 'text-saffron-400' },
    { icon: Camera, title: 'IoT Photo Analysis', desc: 'Upload a photo — YOLOv8 AI detects garbage, potholes, broken lights automatically.', to: '/submit', color: 'text-green-400' },
    { icon: Search, title: 'Real-time Tracking', desc: 'Full timeline from submission to resolution. Before/after photos, citizen verification.', to: '/track', color: 'text-blue-400' },
    { icon: Bot, title: 'AI Chatbot (Claude)', desc: 'Natural language assistant powered by Claude. Ask anything about your complaint.', to: '/chatbot', color: 'text-purple-400' },
    { icon: Map, title: 'Interactive Heatmap', desc: 'Live Leaflet map with color-coded complaint pins and hotspot detection.', to: '/#map', color: 'text-red-400' },
    { icon: BarChart3, title: 'R Analytics Engine', desc: 'ggplot2 charts: weekly trends, category breakdown, department performance, resolution histograms.', to: '/admin', color: 'text-yellow-400' },
    { icon: Shield, title: 'ML Priority Scoring', desc: 'XGBoost model scores complaint urgency 0-100. ETA prediction for resolution time.', to: '/admin', color: 'text-indigo-400' },
    { icon: Bell, title: 'Multi-channel Alerts', desc: 'Email, SMS (Twilio), and push notifications at every status change.', to: '/profile', color: 'text-orange-400' },
    { icon: Smartphone, title: 'Mobile App Ready', desc: 'React Native app with OTP login, GPS location capture, camera, and push notifications.', to: '/', color: 'text-cyan-400' },
    { icon: Award, title: 'Gamification', desc: 'Earn points per complaint. Unlock badges. Compete on the city leaderboard.', to: '/profile', color: 'text-pink-400' },
  ];

  const statsDisplay = [
    { label: 'Total Complaints', value: parseInt(stats.total_complaints) || 0, suffix: '', icon: FileText, color: 'text-saffron-400' },
    { label: 'Resolved', value: parseInt(stats.resolved) || 0, suffix: '', icon: CheckCircle, color: 'text-green-400' },
    { label: 'Submitted Today', value: parseInt(stats.today_submitted) || 0, suffix: '', icon: Activity, color: 'text-blue-400' }
  ];

  const cleanlinessScore = Math.round((parseInt(stats.resolved) || 0) / Math.max(parseInt(stats.total_complaints) || 0, 1) * 100);

  return (
    <div className="min-h-screen">
      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background */}
        <div className="absolute inset-0 bg-hero-pattern" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,107,0,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(45,122,82,0.3) 0%, transparent 50%)'
        }} />
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-saffron-500/30 rounded-full animate-bounce-slow"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s`, animationDuration: `${3 + Math.random() * 3}s` }} />
          ))}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-saffron-500/30 text-saffron-400 text-sm font-medium mb-8 animate-fade-in">
            <Zap className="w-4 h-4" />
            <span>AI-Powered Civic Grievance Platform for Bengaluru</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-white mb-6 animate-slide-up leading-tight">
            Report. Track.{' '}
            <span className="gradient-text">Resolve.</span>
          </h1>

          <p className="text-xl text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            SiliconSahaaya brings Bengaluru's civic grievance system into the AI era. Submit complaints, track resolutions in real-time, and help make our city cleaner — powered by YOLOv8, Claude AI, and XGBoost ML.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to="/submit" className="btn-primary text-base py-3 px-8 text-lg">
              <FileText className="w-5 h-5" />
              Submit Complaint
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/track" className="btn-secondary text-base py-3 px-8 text-lg">
              <Search className="w-5 h-5" />
              Track Existing
            </Link>
          </div>

          {/* Live Counter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {statsDisplay.map(({ label, value, suffix, icon: Icon, color }) => (
              <div key={label} className="glass rounded-xl p-4 border border-forest-700/30">
                <Icon className={`w-5 h-5 ${color} mb-2 mx-auto`} />
                <div className={`text-2xl font-bold font-display ${color}`}>
                  {loading ? <div className="skeleton h-7 w-16 mx-auto" /> : <AnimatedCounter end={value} suffix={suffix} />}
                </div>
                <div className="text-xs text-white/50 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center pt-2">
            <div className="w-1.5 h-3 bg-saffron-500 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* LIVE MAP SECTION */}
      <section id="map" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
              Live Complaint <span className="gradient-text">Heatmap</span>
            </h2>
            <p className="text-white/60">Real-time complaint pins color-coded by urgency across Bengaluru</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card p-1 overflow-hidden" style={{ height: '450px' }}>
                <MapContainer
                  center={[12.9716, 77.5946]}
                  zoom={12}
                  style={{ height: '100%', width: '100%', borderRadius: '10px' }}
                  zoomControl={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  {mapComplaints.map((c, i) => (
                    c.lat && c.lng && (
                      <CircleMarker
                        key={i}
                        center={[parseFloat(c.lat), parseFloat(c.lng)]}
                        radius={c.urgency === 'critical' ? 10 : c.urgency === 'high' ? 8 : 6}
                        fillColor={URGENCY_COLORS[c.urgency] || '#22c55e'}
                        color="white"
                        weight={1.5}
                        opacity={0.9}
                        fillOpacity={0.8}
                      >
                        <Popup className="custom-popup">
                          <div className="bg-forest-900 text-white p-2 rounded text-xs min-w-[150px]">
                            <p className="font-bold text-saffron-400">{c.complaint_id}</p>
                            <p className="text-white/80">{c.category}</p>
                            <span className={`status-badge urgency-${c.urgency} mt-1`}>{c.urgency}</span>
                          </div>
                        </Popup>
                      </CircleMarker>
                    )
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Map Legend & Stats */}
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-4">Map Legend</h3>
                {Object.entries(URGENCY_COLORS).map(([key, color]) => (
                  <div key={key} className="flex items-center gap-3 mb-3">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30" style={{ backgroundColor: color }} />
                    <span className="text-sm text-white/80 capitalize">{key} Urgency</span>
                  </div>
                ))}
              </div>

              <div className="card p-5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-saffron-400" />
                  City Cleanliness Score
                </h3>
                <div className="relative">
                  <div className="text-5xl font-display font-bold gradient-text text-center">{cleanlinessScore}%</div>
                  <div className="progress-bar mt-3 h-3">
                    <div className="progress-fill h-full" style={{ width: `${cleanlinessScore}%` }} />
                  </div>
                  <p className="text-xs text-white/50 text-center mt-2">Complaint Resolution Rate</p>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  SLA Targets
                </h3>
                <div className="space-y-2 text-sm">
                  {[
                    { dept: 'Streetlights', days: '2 days', color: 'text-green-400' },
                    { dept: 'Garbage', days: '3 days', color: 'text-green-400' },
                    { dept: 'Water/Sewage', days: '5 days', color: 'text-yellow-400' },
                    { dept: 'Roads', days: '7 days', color: 'text-orange-400' },
                    { dept: 'Parks', days: '10 days', color: 'text-red-400' },
                  ].map(({ dept, days, color }) => (
                    <div key={dept} className="flex justify-between">
                      <span className="text-white/60">{dept}</span>
                      <span className={`font-medium ${color}`}>{days}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
              Everything You Need to <span className="gradient-text">Fix Your City</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Powered by cutting-edge AI, ML, and IoT technology — building the future of civic engagement
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {features.map(({ icon: Icon, title, desc, to, color }, i) => (
              <Link key={i} to={to} className="card p-5 group block">
                <div className={`w-10 h-10 rounded-xl bg-forest-900/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
                <p className="text-white/50 text-xs leading-relaxed">{desc}</p>
                <div className="mt-3 flex items-center gap-1 text-xs text-saffron-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4 bg-forest-950/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-white mb-3">
              How <span className="gradient-text">SiliconSahaaya</span> Works
            </h2>
          </div>
          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Submit', desc: 'Describe your civic issue or upload a photo. AI auto-fills category & urgency.', icon: FileText },
              { step: '02', title: 'AI Analyzes', desc: 'ML model scores priority 0-100 and routes to the right department automatically.', icon: Zap },
              { step: '03', title: 'Track', desc: 'Get real-time updates via email, SMS, and push notifications at each stage.', icon: Clock },
              { step: '04', title: 'Resolved!', desc: 'Field team resolves issue. Before/after photos uploaded. Rate your experience.', icon: CheckCircle },
            ].map(({ step, title, desc, icon: Icon }, i) => (
              <div key={i} className="relative text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-forest-700 to-forest-800 border border-saffron-500/30 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-7 h-7 text-saffron-400" />
                </div>
                <div className="text-5xl font-display font-bold text-forest-700 absolute -top-2 -left-2 opacity-30">{step}</div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-white/50 text-sm">{desc}</p>
                {i < 3 && <div className="hidden sm:block absolute top-8 left-full w-6 border-t-2 border-dashed border-forest-700/50 -translate-x-3" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass rounded-2xl p-10 border border-saffron-500/20">
            <AlertTriangle className="w-12 h-12 text-saffron-400 mx-auto mb-4" />
            <h2 className="text-3xl font-display font-bold text-white mb-4">
              See Something? Report It!
            </h2>
            <p className="text-white/60 mb-8">
              Every complaint you submit helps make Bengaluru cleaner. Our AI ensures it reaches the right department in seconds.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/submit" className="btn-primary py-3 px-8">
                <FileText className="w-5 h-5" />
                Submit Now — It's Free
              </Link>
              <Link to="/chatbot" className="btn-secondary py-3 px-8">
                <Bot className="w-5 h-5" />
                Ask AI Assistant
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
