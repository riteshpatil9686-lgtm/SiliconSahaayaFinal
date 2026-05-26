import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, FileText, Search, Bot, LayoutDashboard, User, 
  Menu, X, Bell, LogOut, ChevronDown, Leaf
} from 'lucide-react';
import api from '../utils/api';

const Navbar = () => {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/users/notifications').then(res => {
        if (res.data.notifications) {
          setNotifCount(res.data.notifications.filter(n => !n.is_read).length);
        }
      }).catch(() => {});
    }
  }, [isAuthenticated]);

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/submit', label: 'Submit Complaint', icon: FileText },
    { to: '/track', label: 'Track', icon: Search },
    { to: '/chatbot', label: 'AI Assistant', icon: Bot },
    ...(isAdmin ? [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(isAuthenticated ? [{ to: '/profile', label: 'Profile', icon: User }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'glass-dark shadow-lg' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-saffron-500 to-saffron-600 flex items-center justify-center shadow-saffron group-hover:scale-110 transition-transform">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-display font-bold text-lg text-white">Silicon</span>
              <span className="font-display font-bold text-lg gradient-text">Sahaaya</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(to) 
                    ? 'bg-saffron-500 text-white shadow-saffron' 
                    : 'text-white/70 hover:text-white hover:bg-forest-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-forest-800/60 hover:bg-forest-700/60 transition-all text-sm text-white"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-saffron-400 to-saffron-600 flex items-center justify-center text-xs font-bold">
                    {(user?.name || user?.phone || 'U')[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:block">{user?.name || user?.phone?.slice(-4)}</span>
                  {notifCount > 0 && (
                    <span className="bg-saffron-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {notifCount}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 glass-dark rounded-xl shadow-xl border border-forest-700/50 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-forest-700/30">
                      <p className="text-xs text-white/50">Signed in as</p>
                      <p className="text-sm font-medium text-white truncate">{user?.name || user?.phone}</p>
                      <span className="text-xs text-saffron-400 capitalize">{user?.role}</span>
                    </div>
                    <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-forest-800/50 hover:text-white transition-colors">
                      <User className="w-4 h-4" /> My Profile
                    </Link>
                    <Link to="/profile#notifications" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-forest-800/50 hover:text-white transition-colors relative">
                      <Bell className="w-4 h-4" /> Notifications
                      {notifCount > 0 && <span className="ml-auto bg-saffron-500 text-white text-xs rounded-full px-1.5">{notifCount}</span>}
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-forest-800/50 hover:text-white transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}
                    <button onClick={() => { logout(); setUserMenuOpen(false); }} className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors w-full">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn-primary text-sm py-2 px-4">
                Sign In
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-forest-800/60 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden glass-dark border-t border-forest-700/30 animate-slide-down">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(to) ? 'bg-saffron-500 text-white' : 'text-white/70 hover:text-white hover:bg-forest-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
