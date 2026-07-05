import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect to original page or dashboard
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid credentials.");
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome Back</h1>
          <p className="text-sm text-gray-400">Sign in to your SkillBridge account</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-300 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
              <Link to="/forgot-password" className="text-xs text-indigo-400 hover:underline">Forgot Password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 text-gray-500" size={16} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Verifying..." : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 pt-2">
          New to SkillBridge?{' '}
          <Link to="/register" className="text-indigo-400 hover:underline font-semibold">Join as Client or Pro</Link>
        </p>
      </motion.div>
    </div>
  );
};
export default Login;
