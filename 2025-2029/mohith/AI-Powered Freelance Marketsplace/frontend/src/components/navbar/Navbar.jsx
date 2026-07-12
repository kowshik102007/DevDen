import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Menu, X, Wallet, MessageSquare, Bell, User as UserIcon, LogOut, 
  Settings, Briefcase, PlusCircle, LayoutDashboard, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../../assets/logo.png';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    setShowProfileDropdown(false);
    navigate('/login');
  };

  return (
    <nav className="glass-nav sticky top-0 z-50 px-6 py-4 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="SkillBridge Logo" className="h-8 w-auto object-contain rounded" />
          <span className="text-2xl font-extrabold tracking-tight font-sans hidden sm:block">
            <span className="text-indigo-500">Skill</span>
            <span className="text-cyan-400">Bridge</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/marketplace" className="text-gray-300 hover:text-white transition font-medium flex items-center gap-1">
            <Search size={16} /> Explore Gigs
          </Link>
          
          {user && (
            <>
              {user.role === 'freelancer' && (
                <Link to="/dashboard" className="text-gray-300 hover:text-white transition font-medium flex items-center gap-1">
                  <LayoutDashboard size={16} /> Freelance Studio
                </Link>
              )}
              {user.role === 'client' && (
                <Link to="/orders" className="text-gray-300 hover:text-white transition font-medium flex items-center gap-1">
                  <Briefcase size={16} /> Manage Orders
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className="text-gray-300 hover:text-white transition font-medium text-rose-400 hover:text-rose-300">
                  Admin Panel
                </Link>
              )}
              
              {/* Wallet widget */}
              <Link to="/wallet" className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 transition px-3 py-1.5 rounded-lg text-sm text-cyan-400 font-semibold">
                <Wallet size={16} />
                <span>₹{(user.wallet?.balance || 0).toFixed(2)}</span>
              </Link>

              {/* Chat & Notifications */}
              <Link to="/messages" className="text-gray-400 hover:text-white transition relative">
                <MessageSquare size={20} />
              </Link>
              <Link to="/notifications" className="text-gray-400 hover:text-white transition relative">
                <Bell size={20} />
              </Link>
              
              {/* Profile Dropdown Trigger */}
              <div className="relative">
                <button 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-2 focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm uppercase">
                    {user.first_name[0]}{user.last_name[0]}
                  </div>
                </button>
                
                <AnimatePresence>
                  {showProfileDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-3 w-52 bg-darkCard border border-darkBorder rounded-xl shadow-xl py-2 z-50"
                    >
                      <div className="px-4 py-2 border-b border-darkBorder mb-1">
                        <p className="text-sm font-semibold text-white">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      
                      <Link 
                        to="/profile" 
                        onClick={() => setShowProfileDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <UserIcon size={16} /> Profile & Resume
                      </Link>
                      
                      <Link 
                        to="/settings" 
                        onClick={() => setShowProfileDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <Settings size={16} /> Settings
                      </Link>
                      
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-rose-400 hover:bg-slate-800 hover:text-rose-300 transition"
                      >
                        <LogOut size={16} /> Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {!user && (
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-gray-300 hover:text-white font-medium transition">
                Sign In
              </Link>
              <Link to="/register" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition text-sm shadow-glow hover:shadow-indigo-500/50">
                Join Now
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Icon */}
        <div className="md:hidden flex items-center gap-4">
          {user && (
            <Link to="/wallet" className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs text-cyan-400 font-semibold">
              <Wallet size={14} />
              <span>₹{(user.wallet?.balance || 0).toFixed(0)}</span>
            </Link>
          )}
          
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-300 hover:text-white focus:outline-none"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden mt-4 overflow-hidden border-t border-darkBorder/40 bg-darkCard/95 rounded-xl px-4 py-4 space-y-3 shadow-2xl"
          >
            <Link to="/marketplace" onClick={() => setIsOpen(false)} className="block py-2 text-gray-300 hover:text-white">
              Explore Gigs
            </Link>
            
            {user ? (
              <>
                {user.role === 'freelancer' && (
                  <Link to="/dashboard" onClick={() => setIsOpen(false)} className="block py-2 text-gray-300 hover:text-white">
                    Freelance Studio
                  </Link>
                )}
                {user.role === 'client' && (
                  <Link to="/orders" onClick={() => setIsOpen(false)} className="block py-2 text-gray-300 hover:text-white">
                    Manage Orders
                  </Link>
                )}
                <Link to="/messages" onClick={() => setIsOpen(false)} className="block py-2 text-gray-300 hover:text-white">
                  Messages
                </Link>
                <Link to="/profile" onClick={() => setIsOpen(false)} className="block py-2 text-gray-300 hover:text-white">
                  Profile & Resume
                </Link>
                <Link to="/settings" onClick={() => setIsOpen(false)} className="block py-2 text-gray-300 hover:text-white">
                  Settings
                </Link>
                <Link to="/wallet" onClick={() => setIsOpen(false)} className="block py-2 text-cyan-400 font-semibold">
                  Wallet (₹{(user.wallet?.balance || 0).toFixed(2)})
                </Link>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left py-2 text-rose-400 flex items-center gap-2"
                >
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <div className="pt-2 flex flex-col gap-2">
                <Link to="/login" onClick={() => setIsOpen(false)} className="text-center py-2 border border-slate-800 rounded-lg text-gray-300 hover:text-white transition">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setIsOpen(false)} className="text-center py-2 bg-indigo-600 rounded-lg text-white font-semibold transition">
                  Join Now
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
export default Navbar;
