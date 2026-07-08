import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, School, Loader2, ArrowLeft
} from 'lucide-react';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';
import type { User } from '../types';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate auth (replace with Supabase auth)
    await new Promise(r => setTimeout(r, 1000));

    const mockUser: User = {
      id: crypto.randomUUID(),
      email,
      name: name || email.split('@')[0],
      role: email.includes('admin') ? 'admin' : 'user',
    };

    setUser(mockUser);
    toast.success(`Welcome${mode === 'signup' ? ', ' + mockUser.name : ' back'}!`);
    navigate('/dashboard');
    setLoading(false);
  };

  const handleDemo = () => {
    const demoUser: User = {
      id: 'demo-user-001',
      email: 'demo@school.edu',
      name: 'Demo Teacher',
      role: 'user',
    };
    setUser(demoUser);
    toast.success('Entered demo mode!');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-dark-900 bg-mesh flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back to landing */}
        <Link to="/" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <div className="glass rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-4 shadow-lg shadow-primary-500/30 animate-pulse-glow">
              <School size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold font-display text-white">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {mode === 'login'
                ? 'Sign in to manage your timetables'
                : 'Start generating clash-free timetables'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  id="auth-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                  className="input-field"
                  required
                />
              </div>
            )}

            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-white/30" />
                <input
                  type="email"
                  id="auth-email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-white/30" />
                <input
                  type={showPass ? 'text' : 'password'}
                  id="auth-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-3.5 text-white/30 hover:text-white/70"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="auth-submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Demo Access */}
          <button
            id="demo-login"
            onClick={handleDemo}
            className="btn-secondary w-full flex items-center justify-center gap-2 mb-5"
          >
            <School size={16} />
            Try Demo (No Login Required)
          </button>

          {/* Toggle mode */}
          <p className="text-center text-sm text-white/50">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-primary-400 hover:text-primary-300 font-medium"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
