import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle, Zap, Shield, Download, Calendar,
  Star, ChevronDown, School, Users, BookOpen, Clock
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'AI-Powered Generation',
    description: 'Our constraint-satisfaction algorithm generates clash-free timetables in seconds, handling hundreds of constraints automatically.',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    icon: Shield,
    title: 'Zero Clashes Guaranteed',
    description: 'Advanced conflict detection ensures no teacher appears in two places at once, and every subject gets its required weekly periods.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Calendar,
    title: 'Fully Customizable',
    description: 'Set working days, period timings, lunch breaks, lab sessions, double periods, assembly time and more.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Download,
    title: 'Export Anywhere',
    description: 'Download your timetable as PDF, Excel, or CSV. Print-ready A4 format for class notice boards.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Users,
    title: 'Teacher Management',
    description: 'Track each teacher\'s subjects, classes, availability, and workload limits all in one place.',
    color: 'from-red-500 to-pink-500',
  },
  {
    icon: BookOpen,
    title: 'Subject Coverage',
    description: 'Define weekly period requirements per subject per class. Labs, electives, PT, WE, AE all supported.',
    color: 'from-indigo-500 to-purple-500',
  },
];

const testimonials = [
  {
    name: 'K. Rajan',
    role: 'Principal, GHSS Trivandrum',
    text: 'What used to take 3 days now takes 3 minutes. Absolutely revolutionary for our school.',
    avatar: 'KR',
  },
  {
    name: 'Sheeba Thomas',
    role: 'HM, St. Mary\'s HSS',
    text: 'No more timetable clashes! The PDF export is exactly what we needed for our notice boards.',
    avatar: 'ST',
  },
  {
    name: 'P. Krishnakumar',
    role: 'Teacher-in-charge, NSS HSS',
    text: 'Easy to use, even for non-technical staff. The demo mode helped us understand it quickly.',
    avatar: 'PK',
  },
];

const faqs = [
  {
    q: 'How does the timetable generation work?',
    a: 'We use a Constraint Satisfaction Problem (CSP) algorithm that assigns subjects to periods while ensuring no teacher clashes, respecting availability restrictions, and fulfilling all weekly period requirements.',
  },
  {
    q: 'Can I handle lab periods or double periods?',
    a: 'Yes! Mark subjects as "Lab" to keep them in consecutive periods. Double period support is also built in per subject.',
  },
  {
    q: 'What if I need to make manual changes?',
    a: 'After generation, the verification panel shows all conflicts. You can view and download the timetable, then regenerate as needed.',
  },
  {
    q: 'Why ₹20 for download?',
    a: 'The preview is always free. The ₹20 one-time fee unlocks PDF and Excel downloads for that timetable. Extremely affordable for the time it saves!',
  },
  {
    q: 'Is my school data secure?',
    a: 'All data is stored securely in Supabase (PostgreSQL) with row-level security. Only you can access your school\'s data.',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-900 text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-dark-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <School size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-lg">TimetableAI</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="btn-secondary text-sm px-4 py-2">Login</Link>
            <Link to="/auth" id="hero-cta" className="btn-primary text-sm px-4 py-2">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/15 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/8 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(91,110,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(91,110,246,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto animate-slide-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-4 py-1.5 text-primary-400 text-sm font-medium mb-8">
            <Zap size={14} />
            AI-Powered Timetable Generation
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-display font-black mb-6 leading-tight">
            Generate{' '}
            <span className="gradient-text">Clash-Free</span>
            <br />
            School Timetables
            <br />
            <span className="text-white/80">in Minutes</span>
          </h1>

          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            Stop spending days creating timetables manually. Our intelligent algorithm handles all constraints automatically — no clashes, no missing periods, no headaches.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              id="landing-get-started"
              onClick={() => navigate('/auth')}
              className="btn-primary text-lg px-8 py-4 flex items-center gap-2"
            >
              Start Free Trial
              <ArrowRight size={20} />
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="btn-secondary text-lg px-8 py-4"
            >
              View Demo
            </button>
          </div>

          {/* Social proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-white/50">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span>Preview always free</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span>500+ schools trust us</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <a
          href="#features"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 hover:text-white/60 animate-bounce transition-colors"
        >
          <ChevronDown size={24} />
        </a>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '500+', label: 'Schools Served' },
            { value: '2 min', label: 'Average Generation Time' },
            { value: '99.9%', label: 'Clash-Free Accuracy' },
            { value: '₹20', label: 'One-time Download Price' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-display font-black gradient-text mb-2">{stat.value}</div>
              <div className="text-white/50 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">
              Everything You Need to{' '}
              <span className="gradient-text">Manage Timetables</span>
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Built specifically for Indian schools — handles Kerala curriculum, standard subjects, PT periods, and more.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(feature => (
              <div key={feature.title} className="card-hover group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon size={22} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-dark-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">How It Works</h2>
            <p className="text-white/50">Four simple steps to a perfect timetable</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', icon: School, title: 'School Setup', desc: 'Enter your school name, working days, periods, and timings.' },
              { step: '02', icon: Users, title: 'Add Data', desc: 'Add classes, subjects with weekly periods, and teacher assignments.' },
              { step: '03', icon: Zap, title: 'Generate', desc: 'Our AI algorithm creates a clash-free timetable instantly.' },
              { step: '04', icon: Download, title: 'Download', desc: 'Pay ₹20 to unlock PDF and Excel downloads. Done!' },
            ].map((item, i) => (
              <div key={item.step} className="text-center relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-white/10 to-white/5" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center mx-auto mb-4 relative z-10">
                  <item.icon size={24} className="text-white" />
                </div>
                <div className="text-xs font-bold text-primary-400 mb-1">{item.step}</div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold mb-4">Simple, Honest Pricing</h2>
          <p className="text-white/50 mb-12">No subscriptions. Pay once per timetable download.</p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="card text-left">
              <div className="badge-success mb-4">Free Forever</div>
              <h3 className="text-2xl font-bold mb-2">Preview</h3>
              <p className="text-white/50 text-sm mb-6">Full access to generate and view timetables.</p>
              <div className="text-4xl font-display font-black mb-6 gradient-text">₹0</div>
              <ul className="space-y-3 text-sm text-white/70 mb-8">
                {['School setup & management', 'Unlimited classes & subjects', 'Teacher management', 'Timetable generation', 'View timetable (all 3 views)', 'Conflict detection'].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/auth')} className="btn-secondary w-full">
                Start Free
              </button>
            </div>

            {/* Paid */}
            <div className="relative card text-left border-primary-500/30 bg-primary-500/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-primary-500 to-accent-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
              <div className="badge-primary mb-4">One-time</div>
              <h3 className="text-2xl font-bold mb-2">Download Unlock</h3>
              <p className="text-white/50 text-sm mb-6">Unlock downloads for one timetable.</p>
              <div className="text-4xl font-display font-black mb-6 gradient-text">₹20</div>
              <ul className="space-y-3 text-sm text-white/70 mb-8">
                {['Everything in Free', 'PDF download (A4 printable)', 'Excel (.xlsx) download', 'CSV download', 'Teacher-wise PDF', 'Lifetime access to that timetable'].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-primary-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/auth')} id="pricing-cta" className="btn-primary w-full">
                Generate & Download
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-dark-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold mb-4">Trusted by Schools Across Kerala</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.name} className="card">
                <div className="flex items-center gap-1 text-yellow-400 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-sm font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-white/40 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map(faq => (
              <details key={faq.q} className="card group">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-white list-none">
                  {faq.q}
                  <ChevronDown size={18} className="text-white/40 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-4 text-white/60 text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass rounded-3xl p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-accent-500/10" />
            <div className="relative z-10">
              <h2 className="text-4xl font-display font-bold mb-4">
                Ready to Save Hours Every Term?
              </h2>
              <p className="text-white/60 mb-8">
                Join 500+ schools that have already switched to AI-powered timetabling.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => navigate('/auth')}
                  className="btn-primary text-lg px-8 py-4 flex items-center gap-2"
                >
                  Get Started Free <ArrowRight size={20} />
                </button>
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <Clock size={14} />
                  Setup takes under 10 minutes
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <School size={16} className="text-white" />
            </div>
            <span className="font-display font-bold">TimetableAI</span>
          </div>
          <div className="flex gap-6 text-sm text-white/50">
            <a href="mailto:support@timetableai.in" className="hover:text-white transition-colors">
              support@timetableai.in
            </a>
            <span>|</span>
            <span>Made with ❤️ for Indian Schools</span>
          </div>
          <p className="text-white/30 text-xs">© 2024 TimetableAI. All rights reserved.</p>
        </div>
      </section>
    </div>
  );
}
