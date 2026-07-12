import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, CheckCircle, Key } from 'lucide-react';
import { motion } from 'framer-motion';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1); // 1 = Request, 2 = Reset
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestToken = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate password reset.");
      }
      
      // Successfully generated a token
      setToken(data.token || '');
      setStep(2);
      setSuccessMsg("Development Mode: Token generated successfully!");
    } catch (err) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!token || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }
      
      setSuccessMsg("Password reset successfully! Redirecting to login...");
      setError('');
      
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12 relative">
      <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-8 space-y-6 shadow-2xl relative z-10"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Reset Password</h1>
          <p className="text-sm text-gray-400">Recover your SkillBridge account</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-300 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-900/40 text-emerald-300 text-xs">
            <CheckCircle size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestToken} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 text-gray-500" size={16} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full bg-slate-900/60 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-white transition"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition shadow-glow hover:shadow-indigo-500/50 flex items-center justify-center gap-2"
            >
              {loading ? "Requesting..." : "Send Reset Token"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reset Token</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-3.5 text-gray-500" size={16} />
                <input 
                  type="text" 
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token here"
                  className="w-full bg-slate-900/60 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-white transition"
                  required
                />
              </div>
              <p className="text-[10px] text-gray-400">
                For convenience, the token generated on the server has been pre-filled.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-gray-500" size={16} />
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/60 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-white transition"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-gray-500" size={16} />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/60 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-white transition"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition shadow-glow hover:shadow-indigo-500/50 flex items-center justify-center gap-2"
            >
              {loading ? "Updating..." : "Save New Password"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 pt-2">
          Remember your password?{' '}
          <Link to="/login" className="text-indigo-400 hover:underline font-semibold">Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
};
