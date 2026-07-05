import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  PlusCircle, BookOpen, Clock, Activity, Settings, 
  Trash, Edit2, AlertCircle, Play, ShieldAlert, BarChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Dashboard = () => {
  const { user, token } = useAuth();
  
  // Dashboard states
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create Gig modal states
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Artificial Intelligence');
  const [price, setPrice] = useState('');
  const [delivery, setDelivery] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch user orders
      const ordersRes = await fetch('http://localhost:5000/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }
      
      // 2. Fetch user services
      const servicesRes = await fetch('http://localhost:5000/api/services');
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        // Filter those owned by current freelancer user
        const owned = servicesData.filter(s => s.freelancer_id === user.id);
        setServices(owned);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateGig = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!title || !price || !delivery || !description) {
      setError("Please fill in all mandatory fields.");
      return;
    }
    
    try {
      const res = await fetch('http://localhost:5000/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          category,
          price: parseFloat(price),
          delivery_days: parseInt(delivery),
          description,
          requirements
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create service");
      
      setSuccess("Service gig published successfully!");
      setTitle('');
      setPrice('');
      setDelivery('');
      setDescription('');
      setRequirements('');
      
      // Refresh
      fetchDashboardData();
      
      setTimeout(() => {
        setShowModal(false);
        setSuccess('');
      }, 1500);
      
    } catch (err) {
      setError(err.message || "An error occurred.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 animate-pulse space-y-6">
        <div className="h-10 w-1/4 bg-darkCard border border-darkBorder rounded" />
        <div className="h-60 bg-darkCard border border-darkBorder rounded" />
      </div>
    );
  }

  // Calculate metrics
  const activeOrdersCount = orders.filter(o => ['active', 'delivered', 'revision_requested'].includes(o.status)).length;
  const completedJobsCount = user.profile?.completed_jobs || 0;
  const earningsAmount = user.profile?.earnings || 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      
      {/* Header row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white font-sans">
            {user.role === 'freelancer' ? 'Freelance Studio' : 'Client Hub'}
          </h1>
          <p className="text-sm text-gray-400">Welcome, {user.first_name}. Monitor contracts and analyze performance.</p>
        </div>
        
        {user.role === 'freelancer' && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl transition text-xs shadow-glow flex items-center gap-1.5"
          >
            <PlusCircle size={16} /> Publish New Gig
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-5 space-y-2">
          <p className="text-xxs text-gray-400 uppercase tracking-wider">Account Role</p>
          <p className="text-xl font-bold text-white capitalize">{user.role}</p>
        </div>
        
        <div className="glass-panel p-5 space-y-2">
          <p className="text-xxs text-gray-400 uppercase tracking-wider">Active Contracts</p>
          <p className="text-xl font-bold text-indigo-400">{activeOrdersCount}</p>
        </div>
        
        <div className="glass-panel p-5 space-y-2">
          <p className="text-xxs text-gray-400 uppercase tracking-wider">Completed Jobs</p>
          <p className="text-xl font-bold text-emerald-400">{completedJobsCount}</p>
        </div>

        <div className="glass-panel p-5 space-y-2">
          <p className="text-xxs text-gray-400 uppercase tracking-wider">
            {user.role === 'freelancer' ? 'Total Earnings' : 'Total Spent'}
          </p>
          <p className="text-xl font-bold text-cyan-400">
            ₹{user.role === 'freelancer' ? earningsAmount.toLocaleString() : (user.profile?.total_spent || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Main Grid: Freelancer Gigs & Performance Chart */}
      {user.role === 'freelancer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Services list */}
          <div className="lg:col-span-2 glass-panel p-6 space-y-5">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder pb-2.5">
              <BookOpen size={16} /> My Services (Gigs)
            </h3>
            
            {services.length > 0 ? (
              <div className="space-y-3">
                {services.map((svc) => (
                  <div key={svc.id} className="p-4 bg-slate-900/60 border border-darkBorder rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xxs font-semibold text-indigo-400 uppercase">{svc.category}</span>
                      <h4 className="text-xs font-bold text-white leading-normal">{svc.title}</h4>
                      <p className="text-xxs text-cyan-400 font-semibold pt-0.5">₹{svc.price.toLocaleString()} • {svc.delivery_days} Days</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-900 text-emerald-400 text-xxs font-bold">Active</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">You haven't published any gigs yet. Click 'Publish New Gig' to list services!</p>
            )}
          </div>

          {/* Performance chart */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder pb-2.5">
              <BarChart size={16} /> Sales Performance
            </h3>
            
            {/* Inline SVG Chart bar */}
            <div className="bg-slate-950 p-4 rounded-xl border border-darkBorder flex items-end justify-between h-44 pt-6">
              {[
                { label: 'Jan', val: 20 },
                { label: 'Feb', val: 35 },
                { label: 'Mar', val: 55 },
                { label: 'Apr', val: 40 },
                { label: 'May', val: 80 },
                { label: 'Jun', val: 95 }
              ].map((bar, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2">
                  <div 
                    style={{ height: `${bar.val * 1.2}px` }} 
                    className="w-5 bg-gradient-to-t from-indigo-600 to-cyan-400 rounded-t shadow-glow" 
                  />
                  <span className="text-xxs text-gray-500">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Orders Table Section */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder pb-2.5">
          <Clock size={16} /> Contract Ledger (Active & Past Orders)
        </h3>

        {orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-darkBorder text-gray-400 uppercase tracking-widest text-xxs font-bold">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Gig Title</th>
                  <th className="py-3 px-4">{user.role === 'freelancer' ? 'Client' : 'Freelancer'}</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-darkBorder/40">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-900/30 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-400">#{ord.id}</td>
                    <td className="py-3.5 px-4 text-white font-medium max-w-[200px] truncate">{ord.service_title}</td>
                    <td className="py-3.5 px-4 text-gray-300">
                      {user.role === 'freelancer' ? ord.client_name : ord.freelancer_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-xxs font-bold ${
                        ord.status === 'completed' 
                          ? 'bg-emerald-950/60 border border-emerald-900 text-emerald-400'
                          : ord.status === 'active'
                          ? 'bg-indigo-950/60 border border-indigo-900 text-indigo-400'
                          : 'bg-yellow-950/60 border border-yellow-900 text-yellow-500'
                      }`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-cyan-400 font-extrabold">₹{ord.price.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-400 p-2">No active contracts. Hire a freelancer or explore listings to get started!</p>
        )}
      </div>

      {/* Gig Creation Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-darkCard border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-darkBorder pb-2.5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Create Freelance Gig</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white font-bold text-sm">Close</button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900/40 text-red-300 text-xs rounded-lg">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-900/40 text-emerald-300 text-xs rounded-lg">
                  <BookOpen size={16} />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleCreateGig} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Service Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. I will build an AI Chatbot"
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-gray-300"
                    >
                      <option value="Artificial Intelligence">Artificial Intelligence</option>
                      <option value="Web Development">Web Development</option>
                      <option value="Graphic Design">Graphic Design</option>
                      <option value="Video Editing">Video Editing</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Price (₹)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Delivery Days</label>
                  <input
                    type="number"
                    value={delivery}
                    onChange={(e) => setDelivery(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Gig Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Provide a comprehensive description of features you offer..."
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl p-4 text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Buyer Requirements (Optional)</label>
                  <input
                    type="text"
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="e.g. Provide document file link or wireframes"
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold transition text-xs text-white"
                >
                  Publish Service Listing
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Dashboard;
