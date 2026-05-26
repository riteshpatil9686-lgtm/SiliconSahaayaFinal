import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Phone, Lock, ArrowRight, Leaf, Loader, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const { sendOTP, verifyOTP, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('otp'); // 'otp' | 'admin'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) return toast.error('Enter valid 10-digit phone number');
    setLoading(true);
    try {
      const res = await sendOTP(phone);
      setOtpSent(true);
      if (res.otp) { setDemoOtp(res.otp); toast.success(`Demo OTP: ${res.otp}`, { duration: 8000 }); }
      else toast.success('OTP sent to your phone!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('Enter 6-digit OTP');
    setLoading(true);
    try {
      await verifyOTP(phone, otp);
      navigate('/profile');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin(phone || '9999999999', password);
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-hero-pattern">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-saffron-500 to-saffron-600 flex items-center justify-center mx-auto mb-4 shadow-saffron">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">SiliconSahaaya</h1>
          <p className="text-white/50 text-sm mt-1">Sign in to report civic issues</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-1 mb-6 p-1 glass rounded-xl">
          <button onClick={() => { setMode('otp'); setOtpSent(false); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'otp' ? 'bg-saffron-500 text-white' : 'text-white/50 hover:text-white'}`}>
            <Phone className="w-4 h-4 inline mr-2" />Citizen OTP
          </button>
          <button onClick={() => setMode('admin')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'admin' ? 'bg-saffron-500 text-white' : 'text-white/50 hover:text-white'}`}>
            <Shield className="w-4 h-4 inline mr-2" />Admin Login
          </button>
        </div>

        <div className="card p-6">
          {/* OTP LOGIN */}
          {mode === 'otp' && !otpSent && (
            <form onSubmit={handleSendOTP} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Mobile Number</label>
                <div className="flex gap-2">
                  <div className="glass px-3 py-3 rounded-lg text-white/60 text-sm whitespace-nowrap">🇮🇳 +91</div>
                  <input className="input-field flex-1" type="tel" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} maxLength={10} required />
                </div>
              </div>
              <button type="submit" disabled={loading || phone.length !== 10} className="btn-primary w-full justify-center">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
              <p className="text-xs text-white/30 text-center">New users will be auto-registered</p>
            </form>
          )}

          {mode === 'otp' && otpSent && (
            <form onSubmit={handleVerifyOTP} className="space-y-4 animate-fade-in">
              <div className="text-center mb-4">
                <p className="text-white/70 text-sm">OTP sent to <span className="text-saffron-400 font-medium">+91 {phone}</span></p>
                {demoOtp && <p className="text-xs text-green-400 mt-1">Demo OTP: <strong>{demoOtp}</strong></p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Enter 6-digit OTP</label>
                <input className="input-field text-center text-xl tracking-[0.5em] font-mono" type="text" placeholder="------" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} autoFocus required />
              </div>
              <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full justify-center">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Verify & Login</>}
              </button>
              <button type="button" onClick={() => setOtpSent(false)} className="w-full text-xs text-white/30 hover:text-white/60 transition-colors">
                ← Change phone number
              </button>
            </form>
          )}

          {/* ADMIN LOGIN */}
          {mode === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4 animate-fade-in">
              <div className="p-3 bg-saffron-500/10 border border-saffron-500/30 rounded-lg text-xs text-saffron-400 text-center">
                Admin: 9999999999 / SiliconSahaaya@2026
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Admin Phone</label>
                <input className="input-field" placeholder="9999999999" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
                <input className="input-field" type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><Shield className="w-4 h-4" /> Admin Login</>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-4">
          By signing in, you agree to help make Bengaluru cleaner 🌿
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
