import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, Star, Award, FileText, CheckCircle, Clock, ChevronRight, Edit, Loader } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const LEVEL_COLORS = { Newcomer: 'text-gray-400', 'Active Citizen': 'text-blue-400', 'Swachhata Warrior': 'text-purple-400', 'Swachhata Champion': 'text-saffron-400' };
const BADGE_ICONS = { 'First Reporter': '🏆', 'Active Citizen': '⭐', 'Swachhata Champion': '🎖️', '10 Reports': '🥇', 'Quick Resolver': '⚡' };

const CitizenProfilePage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const { updateProfile } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    fetchProfile();
    fetchLeaderboard();
  }, [isAuthenticated]);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/profile');
      setProfile(res.data);
      setEditForm({ name: res.data.user?.name || '', email: res.data.user?.email || '' });
    } catch { toast.error('Failed to load profile'); }
    finally { setLoading(false); }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/users/leaderboard');
      setLeaderboard(res.data.leaderboard || []);
    } catch {}
  };

  const saveProfile = async () => {
    try {
      await updateProfile(editForm);
      setEditMode(false);
      toast.success('Profile updated!');
      fetchProfile();
    } catch { toast.error('Update failed'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader className="w-8 h-8 text-saffron-500 animate-spin" /></div>;

  const pts = profile?.points || {};
  const level = pts.level || 'Newcomer';
  const totalPoints = pts.total_points || 0;
  const nextLevelPoints = { Newcomer: 50, 'Active Citizen': 150, 'Swachhata Warrior': 300, 'Swachhata Champion': 500 }[level] || 500;
  const progressPct = Math.min(100, (totalPoints / nextLevelPoints) * 100);

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="max-w-4xl mx-auto pt-6">
        {/* Profile Header */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-forest-700 to-saffron-600 flex items-center justify-center text-3xl font-bold text-white">
              {(profile?.user?.name || user?.phone || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              {editMode ? (
                <div className="space-y-2">
                  <input className="input-field py-2 text-sm" placeholder="Your name" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                  <input className="input-field py-2 text-sm" placeholder="Email address" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                  <div className="flex gap-2">
                    <button onClick={saveProfile} className="btn-primary text-sm py-1.5 px-4">Save</button>
                    <button onClick={() => setEditMode(false)} className="btn-secondary text-sm py-1.5 px-4">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white">{profile?.user?.name || 'Anonymous Citizen'}</h1>
                    <button onClick={() => setEditMode(true)} className="text-white/30 hover:text-white/70"><Edit className="w-4 h-4" /></button>
                  </div>
                  <p className="text-white/50 text-sm">{profile?.user?.phone}</p>
                  <p className={`text-sm font-medium mt-1 ${LEVEL_COLORS[level]}`}>{level}</p>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-display font-bold gradient-text">{totalPoints}</p>
              <p className="text-sm text-white/50">Swachhata Points</p>
              {pts.rank && <p className="text-xs text-white/30 mt-1">Rank #{pts.rank} in city</p>}
            </div>
          </div>

          {/* Points Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/40 mb-1">
              <span>{level}</span>
              <span>{totalPoints} / {nextLevelPoints} pts to next level</span>
            </div>
            <div className="progress-bar h-2">
              <div className="progress-fill h-full transition-all duration-1000" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-forest-900/40 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-saffron-400">{pts.complaints_submitted || 0}</p>
              <p className="text-xs text-white/40">Submitted</p>
            </div>
            <div className="bg-forest-900/40 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-400">{pts.complaints_resolved || 0}</p>
              <p className="text-xs text-white/40">Resolved</p>
            </div>
            <div className="bg-forest-900/40 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-purple-400">{profile?.badges?.length || 0}</p>
              <p className="text-xs text-white/40">Badges</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {['overview', 'complaints', 'badges', 'leaderboard'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === t ? 'bg-saffron-500 text-white' : 'text-white/50 hover:text-white glass'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-fade-in">
            <div className="card p-5">
              <h3 className="font-semibold text-white mb-4">Gamification Progress</h3>
              <div className="space-y-3">
                {[
                  { label: 'Submit 1st Complaint', done: (pts.complaints_submitted || 0) >= 1, points: '+10 pts' },
                  { label: 'Submit 5 Complaints', done: (pts.complaints_submitted || 0) >= 5, points: '+50 pts' },
                  { label: 'Submit 10 Complaints', done: (pts.complaints_submitted || 0) >= 10, points: '+100 pts' },
                  { label: 'Get a complaint resolved within SLA', done: (pts.complaints_resolved || 0) >= 1, points: '+20 pts' },
                  { label: 'Reach Swachhata Warrior level', done: totalPoints >= 150, points: 'Badge unlock' },
                ].map(({ label, done, points }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-forest-700/20 last:border-0">
                    <div className="flex items-center gap-3">
                      {done ? <CheckCircle className="w-4 h-4 text-green-400" /> : <div className="w-4 h-4 rounded-full border border-white/20" />}
                      <span className={`text-sm ${done ? 'text-white/70 line-through' : 'text-white'}`}>{label}</span>
                    </div>
                    <span className="text-xs text-saffron-400 font-medium">{points}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Link to="/submit" className="card p-5 hover:border-saffron-500/30 transition-all">
                <FileText className="w-6 h-6 text-saffron-400 mb-2" />
                <p className="font-medium text-white text-sm">Submit Complaint</p>
                <p className="text-xs text-white/40 mt-1">Earn 10 points</p>
              </Link>
              <Link to="/track" className="card p-5 hover:border-saffron-500/30 transition-all">
                <Clock className="w-6 h-6 text-blue-400 mb-2" />
                <p className="font-medium text-white text-sm">Track My Complaints</p>
                <p className="text-xs text-white/40 mt-1">{pts.complaints_submitted || 0} active</p>
              </Link>
            </div>
          </div>
        )}

        {/* MY COMPLAINTS */}
        {activeTab === 'complaints' && (
          <div className="space-y-3 animate-fade-in">
            {profile?.complaints?.length === 0 && (
              <div className="card p-10 text-center">
                <FileText className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40">No complaints submitted yet</p>
                <Link to="/submit" className="btn-primary mt-4 inline-flex">Submit Your First Complaint</Link>
              </div>
            )}
            {profile?.complaints?.map(c => (
              <Link key={c.complaint_id} to={`/track?id=${c.complaint_id}`} className="card p-4 block hover:border-saffron-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs text-saffron-400">{c.complaint_id}</p>
                    <p className="text-white font-medium text-sm mt-1">{c.title}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-white/40">{c.category}</span>
                      <span className="text-xs text-white/20">·</span>
                      <span className="text-xs text-white/40">{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                      {c.citizen_rating && <span className="text-xs text-saffron-400">{'★'.repeat(c.citizen_rating)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-badge status-${c.status} text-xs`}>{c.status}</span>
                    <ChevronRight className="w-4 h-4 text-white/30" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* BADGES */}
        {activeTab === 'badges' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {profile?.badges?.map((b, i) => (
                <div key={i} className="card p-5 text-center">
                  <div className="text-4xl mb-2">{BADGE_ICONS[b.badge_name] || b.badge_icon || '🏅'}</div>
                  <p className="font-semibold text-white text-sm">{b.badge_name}</p>
                  <p className="text-xs text-white/40 mt-1">{b.description}</p>
                  <p className="text-xs text-saffron-400 mt-2">{new Date(b.earned_at).toLocaleDateString('en-IN')}</p>
                </div>
              ))}
              {(!profile?.badges || profile.badges.length === 0) && (
                <div className="col-span-3 card p-10 text-center">
                  <Award className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">No badges yet — start submitting complaints to earn badges!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="card animate-fade-in">
            <div className="p-5 border-b border-forest-700/30 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-saffron-400" />
              <h3 className="font-semibold text-white">City Leaderboard — Top Citizens</h3>
            </div>
            <div className="divide-y divide-forest-700/20">
              {leaderboard.map((citizen, i) => (
                <div key={i} className={`flex items-center gap-4 p-4 ${citizen.phone === user?.phone ? 'bg-saffron-500/10 border-l-2 border-saffron-500' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-orange-500 text-white' : 'bg-forest-800 text-white/60'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{citizen.name || `Citizen ${citizen.phone?.slice(-4)}`}</p>
                    <p className={`text-xs ${LEVEL_COLORS[citizen.level] || 'text-white/40'}`}>{citizen.level}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-saffron-400">{citizen.total_points}</p>
                    <p className="text-xs text-white/40">{citizen.complaints_submitted} complaints</p>
                  </div>
                  {i < 3 && <span className="text-xl">{['🥇','🥈','🥉'][i]}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitizenProfilePage;
