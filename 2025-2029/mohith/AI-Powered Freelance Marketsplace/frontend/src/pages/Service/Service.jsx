import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Star, Clock, RefreshCw, Check, MessageSquare, AlertTriangle, 
  ChevronDown, ChevronUp, ArrowRight, ShieldCheck, Mail
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Service = () => {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' or 'premium'
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const fetchService = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/services/${id}`);
        if (res.ok) {
          const data = await res.json();
          setGig(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchService();
  }, [id]);

  const handleOrderRedirect = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/service/${id}` } } });
      return;
    }
    
    if (user.role === 'freelancer') {
      alert("Freelancers cannot purchase services. Please register or login with a client account.");
      return;
    }

    // Redirect to checkout page
    navigate(`/checkout?service_id=${id}&package=${activeTab}`);
  };

  const handleContactFreelancer = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    // Navigate to live messaging channel with freelancer
    navigate(`/messages?contact=${gig.freelancer_id}`);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 animate-pulse space-y-6">
        <div className="h-8 w-2/3 bg-darkCard border border-darkBorder rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-darkCard border border-darkBorder rounded" />
          <div className="h-80 bg-darkCard border border-darkBorder rounded" />
        </div>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <AlertTriangle className="text-yellow-500 mx-auto" size={44} />
        <h2 className="text-xl font-bold text-white">Gig Not Found</h2>
        <p className="text-sm text-gray-400">The service listing may have been deactivated or removed by the author.</p>
        <Link to="/marketplace" className="text-indigo-400 font-semibold hover:underline">Return to Marketplace</Link>
      </div>
    );
  }

  const currentPackage = gig.packages[activeTab];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      {/* Category Navigation breadcrumb */}
      <div className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
        <Link to="/marketplace" className="hover:text-white transition">Marketplace</Link>
        <span>&rsaquo;</span>
        <Link to={`/marketplace?category=${encodeURIComponent(gig.category)}`} className="hover:text-white transition">{gig.category}</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight font-sans">
              {gig.title}
            </h1>
            
            {/* Freelancer badge */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold uppercase text-xs">
                  {gig.freelancer_name[0]}
                </div>
                <div>
                  <span className="font-semibold text-white block">{gig.freelancer_name}</span>
                  <span className="text-gray-400 text-xxs block">{gig.freelancer_title || 'Certified Specialist'}</span>
                </div>
              </div>
              <span className="text-darkBorder font-thin text-base hidden sm:inline">|</span>
              <div className="flex items-center gap-1 text-yellow-500">
                <Star size={14} className="fill-yellow-500" />
                <span className="font-bold text-gray-200">{gig.freelancer_rating > 0 ? gig.freelancer_rating.toFixed(2) : "New Pro"}</span>
                <span className="text-gray-500">({gig.reviews?.length || 0} reviews)</span>
              </div>
            </div>
          </div>

          {/* Banner Images */}
          <div className="h-[400px] w-full rounded-2xl overflow-hidden bg-slate-900 border border-darkBorder/40">
            {gig.images && gig.images.length > 0 ? (
              <img 
                src={gig.images[0]} 
                alt={gig.title} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.classList.add('bg-gradient-to-tr', 'from-indigo-950', 'to-slate-950');
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-indigo-950 via-slate-950 to-cyan-950 flex items-center justify-center">
                <Bot size={70} className="text-cyan-400/40 animate-pulse" />
              </div>
            )}
          </div>

          {/* Gig Description */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white font-sans border-b border-darkBorder/50 pb-2.5">
              Service Description
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {gig.description}
            </p>
          </div>

          {/* Freelancer Detailed Card */}
          <div className="glass-panel p-6 space-y-5">
            <h3 className="text-lg font-bold text-white font-sans border-b border-darkBorder/50 pb-2.5">
              About the Freelancer
            </h3>
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold uppercase shrink-0">
                {gig.freelancer_name[0]}
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-1.5">
                    {gig.freelancer_name} <ShieldCheck className="text-indigo-400 fill-indigo-950" size={16} />
                  </h4>
                  <p className="text-xs text-gray-400">{gig.freelancer_title || 'Platform Professional'}</p>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Top-rated partner providing specialized services. Highly communicative and reliable with prompt deliveries.
                </p>
                <button 
                  onClick={handleContactFreelancer}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold pt-1 border border-indigo-500/20 px-3 py-1.5 rounded-lg bg-indigo-950/20"
                >
                  <Mail size={14} /> Message Consultant
                </button>
              </div>
            </div>
          </div>

          {/* Reviews list */}
          <div className="glass-panel p-6 space-y-6">
            <h3 className="text-lg font-bold text-white font-sans border-b border-darkBorder/50 pb-2.5">
              Client Feedback
            </h3>
            {gig.reviews && gig.reviews.length > 0 ? (
              <div className="space-y-6 divide-y divide-darkBorder/40">
                {gig.reviews.map((rev) => (
                  <div key={rev.id} className="pt-5 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-200">{rev.reviewer_name}</p>
                      <div className="flex items-center text-yellow-500">
                        {Array.from({ length: rev.rating }).map((_, idx) => (
                          <Star key={idx} size={12} className="fill-yellow-500" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">"{rev.comment}"</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No client reviews available yet. Hire this freelancer to leave the first rating!</p>
            )}
          </div>

          {/* FAQs Accordion */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white font-sans border-b border-darkBorder/50 pb-2.5">
              Frequently Asked Questions (FAQs)
            </h3>
            <div className="space-y-2.5">
              {gig.faqs?.map((faq, idx) => (
                <div key={idx} className="border border-darkBorder/60 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-900 transition text-left focus:outline-none"
                  >
                    <span className="text-xs font-bold text-white">{faq.question}</span>
                    {openFaq === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {openFaq === idx && (
                    <div className="p-3.5 bg-darkCard border-t border-darkBorder/50 text-xs text-gray-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Pricing Card */}
        <div className="sticky top-24 space-y-6">
          <div className="glass-panel overflow-hidden border border-darkBorder/80 shadow-2xl">
            {/* Tabs selector */}
            <div className="grid grid-cols-2 border-b border-darkBorder bg-slate-950">
              <button
                onClick={() => setActiveTab('basic')}
                className={`py-3.5 text-xs font-extrabold transition focus:outline-none ${
                  activeTab === 'basic'
                    ? 'text-indigo-400 border-b-2 border-indigo-500 bg-darkCard/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Basic
              </button>
              <button
                onClick={() => setActiveTab('premium')}
                className={`py-3.5 text-xs font-extrabold transition focus:outline-none ${
                  activeTab === 'premium'
                    ? 'text-indigo-400 border-b-2 border-indigo-500 bg-darkCard/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Premium Scale
              </button>
            </div>

            {/* Content info */}
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">{currentPackage.name}</h4>
                <p className="text-lg font-black text-cyan-400">₹{currentPackage.price.toLocaleString()}</p>
              </div>

              {/* Fast timing stats */}
              <div className="grid grid-cols-2 gap-4 text-xxs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-cyan-400" />
                  <span>{currentPackage.delivery} Days Delivery</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw size={14} className="text-indigo-400" />
                  <span>Revisions Included</span>
                </div>
              </div>

              {/* Feature checkboxes */}
              <ul className="space-y-2 text-xxs text-gray-300 pt-2 border-t border-darkBorder/40">
                {currentPackage.features.map((feat, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check size={12} className="text-emerald-400" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Hire Button */}
              <button
                onClick={handleOrderRedirect}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition shadow-glow hover:shadow-indigo-500/50 flex items-center justify-center gap-2 text-xs"
              >
                Hire Professional Now <ArrowRight size={14} />
              </button>

              <p className="text-center text-xxs text-gray-500 leading-normal">
                Double-entry escrow protection ensures money leaves your account but goes to freelancer only upon your approval.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Service;
