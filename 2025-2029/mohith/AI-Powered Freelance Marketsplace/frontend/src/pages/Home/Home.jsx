import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bot, Brain, Code, Palette, PlayCircle, Star, Sparkles, 
  ArrowRight, ShieldCheck, CheckCircle2, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GigCard } from '../../components/cards/GigCard';
import { useAuth } from '../../context/AuthContext';
import { GlobeBackground } from '../../components/globe/GlobeBackground';

export const Home = () => {
  const { user } = useAuth();
  const [recommendedGigs, setRecommendedGigs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch recommended gigs from backend
  useEffect(() => {
    const fetchRecommended = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/services/recommended');
        if (res.ok) {
          const data = await res.json();
          setRecommendedGigs(data);
        }
      } catch (err) {
        console.error("Failed to load recommended gigs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecommended();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const categories = [
    { name: 'Artificial Intelligence', icon: <Bot className="text-cyan-400" size={24} />, count: '24 Freelancers', desc: 'Custom RAG agents, LLMs, fine-tuning datasets, prompt engineers.' },
    { name: 'Web Development', icon: <Code className="text-indigo-400" size={24} />, count: '18 Freelancers', desc: 'React, Next.js, Python, Flask, node, PostgreSQL, AWS pipelines.' },
    { name: 'Graphic Design', icon: <Palette className="text-emerald-400" size={24} />, count: '14 Freelancers', desc: 'Brand guidelines, SaaS landing visual designs, logo guidelines.' },
    { name: 'Video Editing', icon: <PlayCircle className="text-rose-400" size={24} />, count: '9 Freelancers', desc: 'Short clips, explainer reels, promotional visual storytelling.' }
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* 1. Hero Section */}
      <section className="dark-hero relative overflow-hidden bg-[#0b0f19] pt-24 pb-28 w-full flex items-center min-h-[600px] border-b border-darkBorder/40">
        {/* Glowing rotating globe canvas background */}
        <GlobeBackground />

        {/* Content columns (with pointer-events controls so drag remains active on background) */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pointer-events-none">
          {/* Left Column (Content) */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6 pointer-events-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Sparkles size={12} />
              <span>Escrow-Protected AI Freelance Hub</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none font-sans text-white">
              Bridge Ambition with <span className="gradient-text">AI Power</span>
            </h1>
            
            <p className="text-lg text-gray-300 max-w-lg leading-relaxed">
              The elite workspace for hiring global web professionals, running ATS-evaluated applications, and trading secure escrow contracts.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/marketplace" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3.5 rounded-xl transition shadow-glow flex items-center gap-2">
                Hire Pros <ArrowRight size={18} />
              </Link>
              {!user && (
                <Link to="/register" className="glass-panel hover:bg-slate-800 text-gray-200 font-semibold px-6 py-3.5 rounded-xl transition border-slate-700">
                  Register Studio
                </Link>
              )}
            </div>

            {/* Quick trust metrics */}
            <div className="grid grid-cols-3 gap-6 border-t border-slate-800 pt-8 mt-4 text-left">
              <div>
                <p className="text-xl md:text-2xl font-black text-white">₹2,84,000+</p>
                <p className="text-xs text-gray-400">Total Volume Cleared</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-white">4.92 / 5</p>
                <p className="text-xs text-gray-400">Contractor Star Rating</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-white">85+ ATS</p>
                <p className="text-xs text-gray-400">Average Resume Score</p>
              </div>
            </div>
          </motion.div>

          {/* Right Column (Intentionally empty space to reveal the beautiful interactive rotating globe background) */}
          <div className="h-[450px] lg:h-full w-full pointer-events-none" />
        </div>
      </section>

      {/* 2. AI Recommendation Section */}
      <section className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-4xl font-extrabold text-white flex items-center gap-2">
              <Bot className="text-indigo-400" size={28} />
              <span>AI Recommended Gigs</span>
            </h2>
            <p className="text-gray-400 text-sm md:text-base">
              Personalized job matchings, rated services, and active contract offerings.
            </p>
          </div>
          <Link to="/marketplace" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            See all services <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 rounded-xl bg-darkCard/40 animate-pulse border border-darkBorder/30" />
            ))}
          </div>
        ) : recommendedGigs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedGigs.slice(0, 3).map((gig) => (
              <GigCard key={gig.id} gig={gig} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center glass-panel max-w-md mx-auto">
            <Bot size={40} className="mx-auto text-indigo-400 mb-4" />
            <p className="text-sm text-gray-300">No recommended gigs found. Publish a service to get started!</p>
          </div>
        )}
      </section>

      {/* 3. Category Browser */}
      <section className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl md:text-4xl font-extrabold text-white">Browse Talents by Category</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">Explore targeted specialists and standard fixed pricing structures.</p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {categories.map((cat, i) => (
            <motion.div 
              key={i} 
              variants={itemVariants}
              className="glass-panel p-6 flex flex-col justify-between hover:border-indigo-500/40 hover:shadow-glow transition-all duration-300"
            >
              <div className="space-y-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl inline-block">
                  {cat.icon}
                </div>
                <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{cat.desc}</p>
              </div>
              <Link 
                to={`/marketplace?category=${encodeURIComponent(cat.name)}`} 
                className="mt-6 text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Browse Listings <ArrowRight size={12} />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* 4. Platform Workflow Map */}
      <section className="bg-darkCard/40 border-y border-darkBorder/40 py-16 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl md:text-4xl font-extrabold text-white">How SkillBridge Works</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">Four simple steps from ordering to payout clearance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="relative text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 font-extrabold mx-auto text-lg">
                1
              </div>
              <h4 className="text-sm font-bold text-white">Browse & Hire</h4>
              <p className="text-xs text-gray-400 leading-relaxed px-4">Find expert-created services or check tailored matching suggestions.</p>
            </div>
            
            <div className="relative text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 font-extrabold mx-auto text-lg">
                2
              </div>
              <h4 className="text-sm font-bold text-white">Secure Escrow</h4>
              <p className="text-xs text-gray-400 leading-relaxed px-4">Checkout via Cards/UPI. Funds are held in absolute safety until approval.</p>
            </div>
            
            <div className="relative text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 font-extrabold mx-auto text-lg">
                3
              </div>
              <h4 className="text-sm font-bold text-white">Discuss & Deliver</h4>
              <p className="text-xs text-gray-400 leading-relaxed px-4">Live chat securely with Socket.IO, upload progress docs, and preview work.</p>
            </div>
            
            <div className="relative text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 font-extrabold mx-auto text-lg">
                4
              </div>
              <h4 className="text-sm font-bold text-white">Complete & Release</h4>
              <p className="text-xs text-gray-400 leading-relaxed px-4">Accept delivery and release escrowed funds directly to freelancer wallet.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
export default Home;
