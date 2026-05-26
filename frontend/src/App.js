import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SubmitComplaintPage from './pages/SubmitComplaintPage';
import TrackComplaintPage from './pages/TrackComplaintPage';
import ChatbotPage from './pages/ChatbotPage';
import AdminDashboard from './pages/AdminDashboard';
import CitizenProfilePage from './pages/CitizenProfilePage';
import LoginPage from './pages/LoginPage';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-saffron-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
};

const AppContent = () => {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/submit" element={<SubmitComplaintPage />} />
          <Route path="/track" element={<TrackComplaintPage />} />
          <Route path="/chatbot" element={<ChatbotPage />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/profile" element={<ProtectedRoute><CitizenProfilePage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<div className="min-h-screen flex items-center justify-center text-center px-4"><div><h1 className="text-4xl font-bold text-white mb-2">404</h1><p className="text-white/50 mb-4">Page not found</p><a href="/" className="btn-primary inline-flex">Go Home</a></div></div>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1a4731', color: 'white', border: '1px solid rgba(45,122,82,0.4)', borderRadius: '10px' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#0d2418' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#0d2418' } },
        duration: 4000,
      }} />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
