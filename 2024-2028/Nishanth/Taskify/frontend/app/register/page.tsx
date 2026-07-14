'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authAPI.register(formData);
      router.push('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-test-id="register-page" className="min-h-screen flex items-center justify-center p-4">
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
          <h1 className="text-3xl font-bold font-playfair">Create Account</h1>
          <p className="text-gray-400 mt-2">Join Taskify and boost your productivity</p>
        </div>

        {/* Registration Form */}
        <div className="glass-effect rounded-2xl p-8">
          <form onSubmit={handleSubmit} data-test-id="register-form">
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4" data-test-id="error-message">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                className="input-field"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-test-id="name-input"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="Choose a username (5-20 characters)"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                minLength={5}
                maxLength={20}
                data-test-id="username-input"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="Create a strong password (8+ characters)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                data-test-id="password-input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Must include uppercase, lowercase, number, and special character
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="confirm_password" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                id="confirm_password"
                type="password"
                className="input-field"
                placeholder="Confirm your password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                required
                data-test-id="confirm-password-input"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full mb-4"
              disabled={loading}
              data-test-id="register-submit"
            >
              {loading ? 'Creating Account...' : 'Register'}
            </button>

            <div className="text-center text-sm">
              <span className="text-gray-400">Already have an account? </span>
              <Link href="/login" className="text-indigo-400 hover:text-indigo-300" data-test-id="login-link">
                Login here
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
