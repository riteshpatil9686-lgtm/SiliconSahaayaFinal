import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { FileText, CheckCircle, Clock, AlertTriangle, Users, TrendingUp, Download, Send, RefreshCw, Loader, Camera, X, ChevronLeft, ChevronRight, Image } from 'lucide-react';
import api, { API_BASE } from '../utils/api';
import toast from 'react-hot-toast';

const COLORS = ['#ff6b00', '#1a4731', '#2d7a52', '#fbbf24', '#3b82f6', '#8b5cf6', '#ec4899'];
const URGENCY_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

const KPICard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <p className="text-2xl font-display font-bold text-white">{value ?? '—'}</p>
    <p className="text-sm text-white/50 mt-1">{label}</p>
    {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
  </div>
);

const AdminDashboard = () => {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', urgency: '', search: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [emailModal, setEmailModal] = useState(null);
  const [emailForm, setEmailForm] = useState({ to_email: '', subject: '', body: '' });
  const [reportLoading, setReportLoading] = useState(false);
  const [mapComplaints, setMapComplaints] = useState([]);
  const [resolveModal, setResolveModal] = useState(null); // { id, notes }
  const [afterImageFile, setAfterImageFile] = useState(null);
  const [afterImagePreview, setAfterImagePreview] = useState(null);
  const [detailDrawer, setDetailDrawer] = useState(null); // full complaint object with images
  const [drawerLoading, setDrawerLoading] = useState(false);
  const afterImageRef = useRef(null);

  useEffect(() => {
    fetchOverview();
    fetchComplaints();
    fetchMap();
  }, []);

  useEffect(() => { fetchComplaints(); }, [filters, page]);

  const fetchOverview = async () => {
    try {
      const res = await api.get('/admin/overview');
      setData(res.data);
    } catch { toast.error('Failed to load overview'); }
    finally { setLoading(false); }
  };

  const fetchComplaints = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) });
      const res = await api.get(`/admin/complaints?${params}`);
      setComplaints(res.data.complaints || []);
      setPagination(res.data.pagination || {});
    } catch {}
  };

  const fetchMap = async () => {
    try {
      const res = await api.get('/complaints/map');
      setMapComplaints(res.data.complaints || []);
    } catch {}
  };

  const openDetail = async (complaint) => {
    setDetailDrawer({ ...complaint, images: [] });
    setDrawerLoading(true);
    try {
      // Fetch full complaint (includes images + timeline)
      const res = await api.get(`/complaints/${complaint.complaint_id}`);
      if (res.data.success) setDetailDrawer(res.data.complaint);
    } catch {}
    finally { setDrawerLoading(false); }
  };

  // Auto-map category → department UUID (no prompt needed)
  const CATEGORY_DEPT_MAP = {
    'Roads':       'd1000000-0000-0000-0000-000000000001',
    'Noise':       'd1000000-0000-0000-0000-000000000001',
    'Garbage':     'd1000000-0000-0000-0000-000000000002',
    'Water':       'd1000000-0000-0000-0000-000000000003',
    'Sewage':      'd1000000-0000-0000-0000-000000000003',
    'Streetlight': 'd1000000-0000-0000-0000-000000000004',
    'Parks':       'd1000000-0000-0000-0000-000000000005',
  };

  const assignComplaint = async (id, category) => {
    const dept = CATEGORY_DEPT_MAP[category] || 'd1000000-0000-0000-0000-000000000001';
    try {
      await api.put(`/admin/complaints/${id}/assign`, { department_id: dept, notes: `Auto-assigned to ${category} department` });
      toast.success(`Assigned to ${category} dept`);
      fetchComplaints();
    } catch { toast.error('Assignment failed'); }
  };

  const resolveComplaint = async () => {
    if (!resolveModal?.id) return;
    const notes = resolveModal.notes?.trim();
    if (!notes) { toast.error('Please enter resolution notes'); return; }
    try {
      await api.put(`/admin/complaints/${resolveModal.id}/resolve`, { resolution_notes: notes, action_taken: 'Field team resolved' });
      // Upload after-image if selected
      if (afterImageFile) {
        const fd = new FormData();
        fd.append('image', afterImageFile);
        await api.post(`/admin/complaints/${resolveModal.id}/after-image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      toast.success('Complaint resolved!');
      setResolveModal(null);
      setAfterImageFile(null);
      setAfterImagePreview(null);
      fetchComplaints();
    } catch { toast.error('Resolution failed'); }
  };

  const escalateComplaint = async (id) => {
    try {
      await api.put(`/admin/complaints/${id}/escalate`, { reason: 'SLA exceeded - escalated by admin' });
      toast.success('Complaint escalated'); fetchComplaints();
    } catch { toast.error('Escalation failed'); }
  };

  const sendEmail = async () => {
    try {
      await api.post('/notifications/send-email', emailForm);
      toast.success('Email sent!'); setEmailModal(null);
    } catch { toast.error('Email failed'); }
  };

  const generateReport = async (type) => {
    setReportLoading(true);
    try {
      const res = await api.get(`/reports/generate?type=${type}&format=pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `silicon-sahaaya-${type}-report.pdf`; a.click();
      toast.success('Report downloaded!');
    } catch { toast.error('Report generation failed'); }
    finally { setReportLoading(false); }
  };

  const TABS = [
    { id: 'overview', label: 'Overview' }, { id: 'complaints', label: 'Complaints' },
    { id: 'heatmap', label: 'Heatmap' }, { id: 'departments', label: 'Departments' },
    { id: 'predictions', label: 'ETA Predictions' }, { id: 'reports', label: 'Reports' },
    { id: 'notifications', label: 'Notifications' },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader className="w-8 h-8 text-saffron-500 animate-spin" />
    </div>
  );

  const kpis = data?.kpis || {};
  const depts = data?.departments || [];
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), submitted: Math.floor(Math.random() * 30) + 5, resolved: Math.floor(Math.random() * 20) + 2 };
  });
  const categoryData = [
    { name: 'Roads', value: 120 }, { name: 'Garbage', value: 95 }, { name: 'Water', value: 78 },
    { name: 'Streetlight', value: 65 }, { name: 'Sewage', value: 55 }, { name: 'Parks', value: 32 }, { name: 'Noise', value: 18 },
  ];

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Admin Dashboard</h1>
            <p className="text-white/50 text-sm">SiliconSahaaya Control Center</p>
          </div>
          <button onClick={fetchOverview} className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-saffron-500 text-white' : 'text-white/60 hover:text-white hover:bg-forest-800/50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KPICard label="Total Complaints" value={kpis.total_complaints} icon={FileText} color="bg-blue-600" />
              <KPICard label="Resolved" value={kpis.resolved} icon={CheckCircle} color="bg-green-600" />
              <KPICard label="Pending" value={kpis.pending} icon={Clock} color="bg-yellow-600" />
              <KPICard label="Avg Resolution" value={kpis.avg_resolution_days ? `${kpis.avg_resolution_days}d` : 'N/A'} icon={TrendingUp} color="bg-purple-600" />
              <KPICard label="Satisfaction" value={kpis.avg_satisfaction ? `${kpis.avg_satisfaction}/5` : 'N/A'} icon={Users} color="bg-saffron-600" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-4">Weekly Complaint Trend</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyData}>
                    <XAxis dataKey="day" stroke="#ffffff30" tick={{ fill: '#ffffff60', fontSize: 12 }} />
                    <YAxis stroke="#ffffff30" tick={{ fill: '#ffffff60', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#0d2418', border: '1px solid #2d7a52', borderRadius: 8, color: 'white' }} />
                    <Bar dataKey="submitted" fill="#ff6b00" radius={[4,4,0,0]} name="Submitted" />
                    <Bar dataKey="resolved" fill="#2d7a52" radius={[4,4,0,0]} name="Resolved" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-5">
                <h3 className="font-semibold text-white mb-4">Category Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0d2418', border: '1px solid #2d7a52', borderRadius: 8, color: 'white' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {categoryData.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-white/50 truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Department Performance */}
            <div className="card p-5">
              <h3 className="font-semibold text-white mb-4">Department Performance</h3>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Department</th><th>Total</th><th>Resolved</th><th>Active</th><th>Avg Days</th><th>Resolution Rate</th></tr>
                  </thead>
                  <tbody>
                    {depts.map(d => (
                      <tr key={d.code}>
                        <td><span className="font-medium text-white">{d.name}</span></td>
                        <td>{d.total || 0}</td>
                        <td className="text-green-400">{d.resolved || 0}</td>
                        <td className="text-orange-400">{d.active || 0}</td>
                        <td>{d.avg_days || 'N/A'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="progress-bar w-20 h-1.5">
                              <div className="progress-fill h-full" style={{ width: `${d.resolution_rate || 0}%` }} />
                            </div>
                            <span className="text-xs">{d.resolution_rate || 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COMPLAINTS TAB */}
        {tab === 'complaints' && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['status', 'category', 'urgency'].map(f => (
                <select key={f} className="input-field text-sm py-2" value={filters[f]} onChange={e => setFilters(p => ({ ...p, [f]: e.target.value }))}>
                  <option value="">All {f}es</option>
                  {f === 'status' && ['submitted','ai_analyzed','assigned','in_progress','resolved','closed','escalated'].map(s => <option key={s} value={s}>{s}</option>)}
                  {f === 'category' && ['Roads','Garbage','Water','Streetlight','Sewage','Parks','Noise'].map(c => <option key={c} value={c}>{c}</option>)}
                  {f === 'urgency' && ['low','medium','high','critical'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              ))}
              <input className="input-field text-sm py-2" placeholder="Search ID, title..." value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} />
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>ID</th><th>Title</th><th>Category</th><th>Status</th><th>Urgency</th><th>Citizen</th><th>Date</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {complaints.map(c => (
                      <tr key={c.id}>
                        <td><span className="font-mono text-xs text-saffron-400">{c.complaint_id}</span></td>
                        <td><span className="text-white text-sm" title={c.title}>{c.title?.slice(0,40)}...</span></td>
                        <td><span className="text-white/70 text-xs">{c.category}</span></td>
                        <td><span className={`status-badge status-${c.status} text-xs`}>{c.status}</span></td>
                        <td><span className={`status-badge urgency-${c.urgency} text-xs capitalize`}>{c.urgency}</span></td>
                        <td><span className="text-white/60 text-xs">{c.citizen_name || c.citizen_phone?.slice(-4)}</span></td>
                        <td><span className="text-white/40 text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</span></td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => openDetail(c)} className="text-xs px-2 py-1 rounded bg-forest-800/50 text-white/60 hover:text-white border border-forest-700/30">View</button>
                            <button onClick={() => assignComplaint(c.id, c.category)} className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-400 hover:bg-blue-900/60 border border-blue-700/30">Assign</button>
                            <button onClick={() => setResolveModal({ id: c.id, notes: '' })} className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400 hover:bg-green-900/60 border border-green-700/30">Resolve</button>
                            <button onClick={() => escalateComplaint(c.id)} className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/60 border border-red-700/30">Escalate</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 p-4 border-t border-forest-700/30">
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-3">Prev</button>
                  <span className="text-white/50 text-sm px-2 py-1">{page} / {pagination.totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p+1))} disabled={page === pagination.totalPages} className="btn-secondary text-xs py-1 px-3">Next</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HEATMAP TAB */}
        {tab === 'heatmap' && (
          <div className="animate-fade-in" style={{ height: '600px' }}>
            <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', borderRadius: 12 }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {mapComplaints.map((c, i) => c.lat && c.lng && (
                <CircleMarker key={i} center={[parseFloat(c.lat), parseFloat(c.lng)]}
                  radius={c.urgency === 'critical' ? 10 : 7}
                  fillColor={URGENCY_COLORS[c.urgency]} color="white" weight={1} fillOpacity={0.8}>
                  <Popup>
                    <div className="text-xs"><b className="text-saffron-400">{c.complaint_id}</b><br />{c.category} · {c.urgency}</div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* REPORTS TAB */}
        {tab === 'reports' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid sm:grid-cols-2 gap-4">
              {[{ type: 'weekly', label: 'Weekly Report', desc: 'Last 7 days — complaints, resolutions, department performance' },
                { type: 'monthly', label: 'Monthly Report', desc: 'Last 30 days — comprehensive city intelligence report' }].map(r => (
                <div key={r.type} className="card p-6">
                  <h3 className="font-semibold text-white mb-2">{r.label}</h3>
                  <p className="text-white/50 text-sm mb-4">{r.desc}</p>
                  <button onClick={() => generateReport(r.type)} disabled={reportLoading} className="btn-primary text-sm py-2">
                    {reportLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {tab === 'notifications' && (
          <div className="space-y-6 animate-fade-in">
            <div className="card p-6">
              <h3 className="font-semibold text-white mb-4">Send Manual Notification</h3>
              <div className="space-y-3">
                <input className="input-field" placeholder="Recipient email" value={emailForm.to_email} onChange={e => setEmailForm(p => ({ ...p, to_email: e.target.value }))} />
                <input className="input-field" placeholder="Subject" value={emailForm.subject} onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))} />
                <textarea className="input-field" rows={4} placeholder="Email body..." value={emailForm.body} onChange={e => setEmailForm(p => ({ ...p, body: e.target.value }))} />
                <button onClick={sendEmail} className="btn-primary">
                  <Send className="w-4 h-4" /> Send Email
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DEPARTMENTS TAB */}
        {tab === 'departments' && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-semibold text-white">Department Routing & Performance</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {depts.map(d => (
                <div key={d.code} className="card p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-white">{d.name}</h4>
                      <p className="text-xs text-saffron-400 font-mono">{d.code}</p>
                    </div>
                    <span className="text-xs text-white/40">SLA: {d.sla_days}d</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-lg font-bold text-white">{d.total || 0}</p><p className="text-xs text-white/40">Total</p></div>
                    <div><p className="text-lg font-bold text-green-400">{d.resolved || 0}</p><p className="text-xs text-white/40">Resolved</p></div>
                    <div><p className="text-lg font-bold text-saffron-400">{d.resolution_rate || 0}%</p><p className="text-xs text-white/40">Rate</p></div>
                  </div>
                  <div className="progress-bar mt-3 h-1.5">
                    <div className="progress-fill h-full" style={{ width: `${d.resolution_rate || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ETA PREDICTIONS TAB */}
        {tab === 'predictions' && <ETAPredictionsTab />}
      </div>

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { setResolveModal(null); setAfterImageFile(null); setAfterImagePreview(null); }}>
          <div className="bg-forest-900 rounded-2xl border border-forest-700 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" /> Resolve Complaint
            </h3>
            <textarea
              className="input-field w-full mb-4"
              rows={3}
              placeholder="Enter resolution notes (what was done, by whom)..."
              value={resolveModal.notes}
              onChange={e => setResolveModal(p => ({ ...p, notes: e.target.value }))}
              autoFocus
            />

            {/* After Image Upload */}
            <div className="mb-4">
              <p className="text-sm text-white/60 mb-2 flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> After-work Photo (optional)</p>
              {afterImagePreview ? (
                <div className="relative">
                  <img src={afterImagePreview} alt="after" className="w-full h-40 object-cover rounded-xl" />
                  <button onClick={() => { setAfterImageFile(null); setAfterImagePreview(null); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <span className="absolute bottom-2 left-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">After</span>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-forest-600 rounded-xl p-4 cursor-pointer hover:border-saffron-500/50 transition-colors">
                  <Camera className="w-5 h-5 text-white/40" />
                  <span className="text-sm text-white/40">Click to upload after-work photo</span>
                  <input
                    ref={afterImageRef}
                    type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setAfterImageFile(file); setAfterImagePreview(URL.createObjectURL(file)); }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setResolveModal(null); setAfterImageFile(null); setAfterImagePreview(null); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={resolveComplaint} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Detail Drawer */}
      {detailDrawer && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDetailDrawer(null)}>
          <div className="flex-1 bg-black/60" />
          <div className="w-full max-w-xl bg-forest-950 border-l border-forest-700 overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="sticky top-0 bg-forest-950 border-b border-forest-700 px-5 py-4 flex items-center justify-between z-10">
              <div>
                <p className="text-xs text-white/40">Complaint Details</p>
                <p className="font-bold text-saffron-400 font-mono">{detailDrawer.complaint_id}</p>
              </div>
              <button onClick={() => setDetailDrawer(null)} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {drawerLoading ? (
              <div className="flex items-center justify-center py-20"><Loader className="w-6 h-6 text-saffron-400 animate-spin" /></div>
            ) : (
              <div className="p-5 space-y-5">

                {/* Basic info */}
                <div>
                  <h3 className="font-semibold text-white text-lg mb-1">{detailDrawer.title}</h3>
                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className={`status-badge status-${detailDrawer.status} text-xs`}>{detailDrawer.status}</span>
                    <span className={`status-badge urgency-${detailDrawer.urgency} text-xs capitalize`}>{detailDrawer.urgency}</span>
                    <span className="text-xs bg-forest-800 text-white/60 px-2 py-0.5 rounded">{detailDrawer.category}</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{detailDrawer.description}</p>
                  {detailDrawer.address && <p className="text-xs text-white/40 mt-2">📍 {detailDrawer.address}</p>}
                </div>

                {/* Before / After Images */}
                <div>
                  <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <Image className="w-4 h-4 text-saffron-400" /> Before &amp; After Photos
                  </h4>
                  {(() => {
                    const before = (detailDrawer.images || []).filter(i => i.image_type === 'before');
                    const after = (detailDrawer.images || []).filter(i => i.image_type === 'after');
                    const hasBefore = before.length > 0;
                    const hasAfter = after.length > 0;
                    if (!hasBefore && !hasAfter) {
                      return <p className="text-sm text-white/30 text-center py-6 border border-dashed border-forest-700 rounded-xl">No photos attached</p>;
                    }
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-white/40 mb-1.5 text-center">📸 Before</p>
                          {hasBefore ? (
                            <img
                              src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${before[0].image_url}`}
                              alt="before"
                              className="w-full h-40 object-cover rounded-xl border-2 border-orange-500/30"
                              onError={e => e.target.src = 'https://via.placeholder.com/300x200/1a4731/ffffff?text=Before'}
                            />
                          ) : (
                            <div className="w-full h-40 rounded-xl border-2 border-dashed border-forest-700 flex items-center justify-center">
                              <span className="text-xs text-white/30">No before image</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-white/40 mb-1.5 text-center">✅ After</p>
                          {hasAfter ? (
                            <img
                              src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${after[0].image_url}`}
                              alt="after"
                              className="w-full h-40 object-cover rounded-xl border-2 border-green-500/30"
                              onError={e => e.target.src = 'https://via.placeholder.com/300x200/1a4731/ffffff?text=After'}
                            />
                          ) : (
                            <div className="w-full h-40 rounded-xl border-2 border-dashed border-forest-700 flex flex-col items-center justify-center gap-2">
                              <Camera className="w-5 h-5 text-white/20" />
                              <span className="text-xs text-white/30">No after image</span>
                              <label className="text-xs text-saffron-400 hover:text-saffron-300 cursor-pointer underline">
                                Upload after image
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const fd = new FormData();
                                  fd.append('image', file);
                                  try {
                                    const r = await api.post(`/admin/complaints/${detailDrawer.id}/after-image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                    toast.success('After image uploaded!');
                                    openDetail(detailDrawer);
                                  } catch { toast.error('Upload failed'); }
                                }} />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Upload new after image if one exists */}
                  {(detailDrawer.images || []).some(i => i.image_type === 'after') && (
                    <label className="mt-2 flex items-center gap-1.5 text-xs text-white/40 hover:text-saffron-400 cursor-pointer">
                      <Camera className="w-3.5 h-3.5" /> Replace after image
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append('image', file);
                        try {
                          await api.post(`/admin/complaints/${detailDrawer.id}/after-image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                          toast.success('After image replaced!');
                          openDetail(detailDrawer);
                        } catch { toast.error('Upload failed'); }
                      }} />
                    </label>
                  )}
                </div>

                {/* Resolution notes */}
                {detailDrawer.resolution_notes && (
                  <div className="bg-green-900/20 border border-green-500/20 rounded-xl p-4">
                    <p className="text-xs text-green-400 font-medium mb-1">✅ Resolution Notes</p>
                    <p className="text-sm text-white/80">{detailDrawer.resolution_notes}</p>
                  </div>
                )}

                {/* Timeline */}
                {detailDrawer.timeline?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-3">Timeline</h4>
                    <div className="space-y-3">
                      {detailDrawer.timeline.map((t, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-2 h-2 rounded-full bg-saffron-500 mt-1.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-white capitalize">{t.status}</p>
                            <p className="text-xs text-white/50">{t.description}</p>
                            <p className="text-xs text-white/30">{new Date(t.created_at).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ETAPredictionsTab = () => {
  const [predictions, setPredictions] = useState([]);
  useEffect(() => {
    api.get('/admin/eta-predictions').then(res => setPredictions(res.data.predictions || [])).catch(() => {});
  }, []);

  const chartData = predictions.slice(0, 20).map(p => ({
    id: p.complaint_id?.slice(-6),
    predicted: p.predicted_resolution_days,
    actual: p.actual_resolution_days
  })).filter(d => d.predicted);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card p-5">
        <h3 className="font-semibold text-white mb-4">Predicted vs Actual Resolution Time</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <XAxis dataKey="id" stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 10 }} />
            <YAxis stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 10 }} label={{ value: 'Days', angle: -90, fill: '#ffffff50', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0d2418', border: '1px solid #2d7a52', borderRadius: 8, color: 'white' }} />
            <Bar dataKey="predicted" fill="#ff6b00" radius={[4,4,0,0]} name="Predicted" />
            <Bar dataKey="actual" fill="#2d7a52" radius={[4,4,0,0]} name="Actual" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Complaint ID</th><th>Category</th><th>Priority</th><th>Predicted Days</th><th>Actual Days</th><th>Status</th></tr></thead>
          <tbody>
            {predictions.slice(0, 20).map(p => (
              <tr key={p.complaint_id}>
                <td className="font-mono text-xs text-saffron-400">{p.complaint_id}</td>
                <td className="text-white/70 text-xs">{p.category}</td>
                <td><div className="progress-bar w-16 h-1.5"><div className="progress-fill h-full" style={{ width: `${p.priority_score}%` }} /></div></td>
                <td className="text-blue-400">{p.predicted_resolution_days}d</td>
                <td className="text-green-400">{p.actual_resolution_days || '—'}</td>
                <td><span className={`status-badge status-${p.status} text-xs`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
