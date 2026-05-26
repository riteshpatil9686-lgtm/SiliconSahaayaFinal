import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('ss_token');
    const savedUser = localStorage.getItem('ss_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const sendOTP = async (phone) => {
    const res = await api.post('/auth/send-otp', { phone });
    return res.data;
  };

  const verifyOTP = async (phone, otp) => {
    const res = await api.post('/auth/verify-otp', { phone, otp });
    if (res.data.success) {
      localStorage.setItem('ss_token', res.data.token);
      localStorage.setItem('ss_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      toast.success(`Welcome, ${res.data.user.name || res.data.user.phone}!`);
    }
    return res.data;
  };

  const adminLogin = async (phone, password) => {
    const res = await api.post('/auth/admin-login', { phone, password });
    if (res.data.success) {
      localStorage.setItem('ss_token', res.data.token);
      localStorage.setItem('ss_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      toast.success('Admin login successful!');
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_user');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
  };

  const updateProfile = async (data) => {
    const res = await api.put('/auth/profile', data);
    if (res.data.success) {
      setUser(res.data.user);
      localStorage.setItem('ss_user', JSON.stringify(res.data.user));
    }
    return res.data;
  };

  const isAuthenticated = !!token;
  const isAdmin = user?.role === 'admin';
  const isCitizen = user?.role === 'citizen';

  return (
    <AuthContext.Provider value={{ user, loading, token, isAuthenticated, isAdmin, isCitizen, sendOTP, verifyOTP, adminLogin, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
