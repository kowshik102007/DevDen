'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div data-test-id="landing-page" className="min-h-screen relative overflow-hidden">
      {/* Particle Container */}
      <div className="particle-container fixed top-0 left-0 w-full h-full pointer-events-none z-10">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className={`particle p${i} absolute w-1 h-1 bg-[rgba(224,230,241,0.6)] rounded-full`}
            style={{
              animation: `particle-float 8s ease-in-out infinite ${i}s`,
              top: `${(i * 11) % 100}%`,
              left: `${(i * 13) % 100}%`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4">
        <header className="text-center mb-12">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-2xl shadow-indigo-500/40 mb-8">
            <span className="text-5xl font-extrabold text-white font-playfair">T</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold mb-6 font-playfair">
            <span className="gradient-text">Welcome to Taskify</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto">
            Your intelligent assistant for managing tasks and schedules with AI-powered features
          </p>
        </header>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl w-full mb-12">
          <div className="glass-effect p-6 rounded-2xl transform transition-all hover:scale-105" data-test-id="feature-ai">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Scheduling</h3>
            <p className="text-gray-400">Generate intelligent schedules based on your goals and documents</p>
          </div>
          
          <div className="glass-effect p-6 rounded-2xl transform transition-all hover:scale-105" data-test-id="feature-chat">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-xl font-semibold mb-2">Smart Chat Assistant</h3>
            <p className="text-gray-400">Get productivity tips and schedule recommendations</p>
          </div>
          
          <div className="glass-effect p-6 rounded-2xl transform transition-all hover:scale-105" data-test-id="feature-docs">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-xl font-semibold mb-2">Document Analysis</h3>
            <p className="text-gray-400">Upload documents to generate personalized learning paths</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4" data-test-id="cta-buttons">
          <Link
            href="/login"
            className="btn-primary text-center px-8 py-4 text-lg"
            data-test-id="login-link"
          >
            Login
          </Link>
          
          <Link
            href="/register"
            className="btn-secondary text-center px-8 py-4 text-lg"
            data-test-id="register-link"
          >
            Register
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500">
          <p>&copy; 2025 Taskify. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
