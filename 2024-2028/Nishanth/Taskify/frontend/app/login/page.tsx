'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.login(formData);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-test-id="login-page" className="min-h-screen flex items-center justify-center p-4">
      {/* Particle Background */}
      <div className="particle-container fixed top-0 left-0 w-full h-full pointer-events-none z-10">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="particle absolute w-1 h-1 bg-[rgba(224,230,241,0.6)] rounded-full"
            style={{
              animation: `particle-float 8s ease-in-out infinite ${i}s`,
              top: `${(i * 20) % 100}%`,
              left: `${(i * 25) % 100}%`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-md z-20">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl mb-4">
              <span className="text-4xl font-extrabold text-white font-playfair">T</span>
            </div>
          </Link>
          <h1 className="text-3xl font-bold font-playfair">Welcome Back</h1>
          <p className="text-gray-400 mt-2">Login to access your dashboard</p>
        </div>

        {/* Login Form */}
        <div className="glass-effect rounded-2xl p-8">
          <form onSubmit={handleSubmit} data-test-id="login-form">
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4" data-test-id="error-message">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="Enter your username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                data-test-id="username-input"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                data-test-id="password-input"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full mb-4"
              disabled={loading}
              data-test-id="login-submit"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="text-center text-sm">
              <span className="text-gray-400">Don't have an account? </span>
              <Link href="/register" className="text-indigo-400 hover:text-indigo-300" data-test-id="register-link">
                Register here
              </Link>
            </div>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-gray-400 hover:text-gray-300 text-sm" data-test-id="back-home">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
