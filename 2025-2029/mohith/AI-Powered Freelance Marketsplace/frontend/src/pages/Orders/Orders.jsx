import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Briefcase, CheckCircle, Clock, AlertTriangle, AlertCircle, 
  Send, ExternalLink, RefreshCw, Star, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Orders = () => {
  const { user, token, refreshUser } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Deliverable states
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [deliveringOrderId, setDeliveringOrderId] = useState(null);
  
  // Revision states
  const [revisionNote, setRevisionNote] = useState('');
  const [revisionOrderId, setRevisionOrderId] = useState(null);

  // Review states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewOrderId, setReviewOrderId] = useState(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDeliverSubmit = async (e) => {
    e.preventDefault();
    if (!deliveryNote) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${deliveringOrderId}/deliver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          attachment_url: deliveryUrl,
          note: deliveryNote
        })
      });
      
      if (res.ok) {
        setDeliveryNote('');
        setDeliveryUrl('');
        setDeliveringOrderId(null);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevisionSubmit = async (e) => {
    e.preventDefault();
    if (!revisionNote) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${revisionOrderId}/revision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ note: revisionNote })
      });
      
      if (res.ok) {
        setRevisionNote('');
        setRevisionOrderId(null);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        // Trigger review request popup
        setReviewOrderId(orderId);
        fetchOrders();
        await refreshUser();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    
    // In real app we post to /api/reviews
    setReviewOrderId(null);
    setReviewComment('');
    setReviewRating(5);
    alert("Review submitted successfully! Thank you for rating.");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 animate-pulse space-y-6">
        <div className="h-10 w-1/4 bg-darkCard border border-darkBorder rounded" />
        <div className="h-60 bg-darkCard border border-darkBorder rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 relative">
      <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      <h1 className="text-2xl md:text-3xl font-extrabold text-white font-sans flex items-center gap-2">
        <Briefcase className="text-indigo-400" size={28} /> Contract Hub
      </h1>

      {orders.length > 0 ? (
        <div className="space-y-6">
          {orders.map((o) => (
            <div key={o.id} className="glass-panel p-6 space-y-4">
              
              {/* Top Row ID + status */}
              <div className="flex justify-between items-start border-b border-darkBorder/40 pb-3">
                <div>
                  <span className="text-[10px] text-gray-500 font-mono font-bold">CONTRACT #{o.id}</span>
                  <h3 className="text-sm font-bold text-white leading-snug">{o.service_title}</h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-xxs font-extrabold uppercase ${
                  o.status === 'completed'
                    ? 'bg-emerald-950/60 border border-emerald-900 text-emerald-400'
                    : o.status === 'active'
                    ? 'bg-indigo-950/60 border border-indigo-900 text-indigo-400'
                    : 'bg-yellow-950/60 border border-yellow-900 text-yellow-500'
                }`}>
                  {o.status}
                </span>
              </div>

              {/* Middle row details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xxs text-gray-300">
                <div>
                  <p className="text-gray-500 font-semibold uppercase">Consultant</p>
                  <p className="font-bold text-gray-200 mt-0.5">{o.freelancer_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-semibold uppercase">Client</p>
                  <p className="font-bold text-gray-200 mt-0.5">{o.client_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-semibold uppercase">Contract Budget</p>
                  <p className="font-bold text-cyan-400 mt-0.5 font-sans">₹{o.price.toLocaleString()}</p>
                </div>
              </div>

              {/* Delivery actions if freelancer */}
              {user.role === 'freelancer' && o.status === 'active' && (
                <div className="pt-2 border-t border-darkBorder/30">
                  <button
                    onClick={() => setDeliveringOrderId(o.id)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg text-xs"
                  >
                    Deliver Completed Work
                  </button>
                </div>
              )}

              {/* Accept delivery / Request revision actions if client */}
              {user.role === 'client' && o.status === 'delivered' && (
                <div className="pt-3 border-t border-darkBorder/30 flex gap-3">
                  <button
                    onClick={() => handleCompleteOrder(o.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-xs"
                  >
                    Accept Work & Clear Escrow
                  </button>
                  <button
                    onClick={() => setRevisionOrderId(o.id)}
                    className="bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-750 font-bold py-2 px-4 rounded-lg text-xs"
                  >
                    Request Revision
                  </button>
                </div>
              )}

              {/* Show delivery details if delivered/completed */}
              {['delivered', 'completed'].includes(o.status) && o.delivery_note && (
                <div className="bg-slate-950 p-4 rounded-xl border border-darkBorder text-xxs text-gray-400 space-y-2">
                  <p className="font-bold text-gray-300">Deliverable Notes:</p>
                  <p className="italic">"{o.delivery_note}"</p>
                  {o.delivery_attachment_url && (
                    <a 
                      href={o.delivery_attachment_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <ExternalLink size={12} /> View Delivered Assets
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center glass-panel max-w-sm mx-auto space-y-3">
          <Briefcase size={36} className="mx-auto text-indigo-400" />
          <h3 className="text-sm font-bold text-white">No active contracts</h3>
          <p className="text-xs text-gray-400">Contracts are created when you buy a gig. Visit the Marketplace to hire professionals.</p>
        </div>
      )}

      {/* Deliver Work Modal */}
      <AnimatePresence>
        {deliveringOrderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-darkCard border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-darkBorder pb-2.5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Deliver Completed Work</h3>
                <button onClick={() => setDeliveringOrderId(null)} className="text-gray-400 hover:text-white font-bold text-sm">Cancel</button>
              </div>

              <form onSubmit={handleDeliverSubmit} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase block">Delivery notes</label>
                  <textarea
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    rows={4}
                    placeholder="Provide description details of files/source code..."
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase block">Deliverable link (Drive/GitHub)</label>
                  <input
                    type="text"
                    value={deliveryUrl}
                    onChange={(e) => setDeliveryUrl(e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-2.5 px-4 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition text-xs text-white"
                >
                  Deliver Work
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revision Modal */}
      <AnimatePresence>
        {revisionOrderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-darkCard border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-darkBorder pb-2.5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Request Revision</h3>
                <button onClick={() => setRevisionOrderId(null)} className="text-gray-400 hover:text-white font-bold text-sm">Cancel</button>
              </div>

              <form onSubmit={handleRevisionSubmit} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase block">Revision requirements</label>
                  <textarea
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    rows={4}
                    placeholder="List specific changes needed..."
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition text-xs text-white"
                >
                  Submit Revision Request
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewOrderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-darkCard border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-4 text-center"
            >
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Rate the Freelancer</h3>
              <p className="text-xxs text-gray-400">Share your experience to help the community.</p>

              <form onSubmit={handleReviewSubmit} className="space-y-4 text-left">
                {/* Star rating selector */}
                <div className="flex justify-center gap-2 text-yellow-500 py-2">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button
                      type="button"
                      key={stars}
                      onClick={() => setReviewRating(stars)}
                      className="focus:outline-none"
                    >
                      <Star 
                        size={28} 
                        className={reviewRating >= stars ? "fill-yellow-500 text-yellow-500" : "text-gray-600"} 
                      />
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase block">Review Comments</label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    placeholder="Write a feedback comment..."
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl p-3 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition text-xs text-white"
                >
                  Submit Review
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Orders;
