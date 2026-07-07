import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, User as UserIcon, AlertCircle, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client'); // 'client' or 'freelancer'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      await register(email, password, firstName, lastName, role);
      navigate('/');
    } catch (err) {
      setError(err.message || "Registration failed. Try a different email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12 relative">
      <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg glass-panel p-8 space-y-6 shadow-2xl relative z-10"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Create Account</h1>
          <p className="text-sm text-gray-400">Join the SkillBridge marketplace today</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-300 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div className="grid grid-cols-2 gap-4 pb-2">
            <button
              type="button"
              onClick={() => setRole('client')}
              className={`py-3.5 rounded-xl border font-bold text-sm transition flex flex-col items-center gap-1 ${
                role === 'client'
                  ? 'bg-indigo-950/50 border-indigo-500 text-indigo-400'
                  : 'bg-slate-900/40 border-darkBorder text-gray-400 hover:border-slate-800'
              }`}
            >
              <span>I want to Hire</span>
              <span className="text-xxs font-normal opacity-85">Post jobs & hire freelancers</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('freelancer')}
              className={`py-3.5 rounded-xl border font-bold text-sm transition flex flex-col items-center gap-1 ${
                role === 'freelancer'
                  ? 'bg-indigo-950/50 border-indigo-500 text-indigo-400'
                  : 'bg-slate-900/40 border-darkBorder text-gray-400 hover:border-slate-800'
              }`}
            >
              <span>I want to Work</span>
              <span className="text-xxs font-normal opacity-85">Sell services & earn money</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">First Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 text-gray-500" size={16} />
                <input 
                  type="text" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full bg-slate-900/60 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-white transition"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 text-gray-500" size={16} />
                <input 
                  type="text" 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full bg-slate-900/60 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 pl-11 pr-4 text-sm text-white transition"
                  required
                />
              </div>
            </div>
          </div>

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
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 text-gray-500" size={16} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
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
            {loading ? "Registering..." : "Create Account"}
          </button>
        </form>

        <div className="border-t border-darkBorder/40 pt-4 text-center text-xxs text-gray-500 flex items-center justify-center gap-1.5">
          <Shield size={12} className="text-indigo-400" /> By creating an account you agree to SkillBridge Escrow Policies.
        </div>

        <p className="text-center text-xs text-gray-400 pt-2">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:underline font-semibold">Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
};
export default Register;
