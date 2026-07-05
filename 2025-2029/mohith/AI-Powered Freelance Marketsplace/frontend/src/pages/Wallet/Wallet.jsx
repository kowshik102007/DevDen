import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, History, 
  AlertCircle, CheckCircle, Plus, Landmark, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Wallet = () => {
  const { user, token, refreshUser } = useAuth();
  
  // Wallet states
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actioning, setActioning] = useState(false);

  const fetchWalletDetails = async () => {
    try {
      // 1. Fetch wallet
      const walletRes = await fetch('http://localhost:5000/api/wallet', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (walletRes.ok) {
        const walletData = await walletRes.json();
        setWallet(walletData);
      }
      
      // 2. Fetch transactions
      const txnsRes = await fetch('http://localhost:5000/api/wallet/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (txnsRes.ok) {
        const txnsData = await txnsRes.json();
        setTransactions(txnsData);
      }
    } catch (e) {
      console.error("Failed to load wallet data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletDetails();
  }, []);

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const depositAmt = parseFloat(amount);
    if (isNaN(depositAmt) || depositAmt <= 0) {
      setError("Please enter a valid deposit amount.");
      return;
    }
    
    setActioning(true);
    
    try {
      const res = await fetch('http://localhost:5000/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: depositAmt, method })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deposit failed");
      
      setSuccess(`Successfully deposited ₹${depositAmt.toLocaleString()}!`);
      setAmount('');
      await refreshUser(); // update context user
      await fetchWalletDetails(); // update local transactions
      
      setTimeout(() => {
        setShowDepositModal(false);
        setSuccess('');
      }, 1500);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const withdrawAmt = parseFloat(amount);
    if (isNaN(withdrawAmt) || withdrawAmt <= 0) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }
    
    if (wallet.balance < withdrawAmt) {
      setError("Insufficient available balance.");
      return;
    }
    
    setActioning(true);
    
    try {
      const res = await fetch('http://localhost:5000/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: withdrawAmt })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      
      setSuccess(`Successfully withdrew ₹${withdrawAmt.toLocaleString()} to your bank!`);
      setAmount('');
      await refreshUser();
      await fetchWalletDetails();
      
      setTimeout(() => {
        setShowWithdrawModal(false);
        setSuccess('');
      }, 1500);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 animate-pulse space-y-6">
        <div className="h-10 w-1/4 bg-darkCard border border-darkBorder rounded" />
        <div className="h-44 bg-darkCard border border-darkBorder rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 relative">
      <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

      <h1 className="text-2xl md:text-3xl font-extrabold text-white font-sans flex items-center gap-2">
        <WalletIcon className="text-cyan-400" size={28} /> Escrow Balance Wallet
      </h1>

      {/* Balance panel cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 bg-gradient-to-tr from-indigo-950/20 via-slate-900/60 to-cyan-950/20 space-y-4">
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-widest">Available Balance</p>
          <h2 className="text-3xl font-black text-cyan-400">₹{(wallet?.balance || 0).toLocaleString()}</h2>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setError(''); setSuccess(''); setShowDepositModal(true); }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 font-bold py-2.5 rounded-lg text-xs text-white flex items-center justify-center gap-1 shadow-glow"
            >
              <ArrowDownCircle size={14} /> Deposit
            </button>
            <button
              onClick={() => { setError(''); setSuccess(''); setShowWithdrawModal(true); }}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 font-bold py-2.5 rounded-lg text-xs text-white flex items-center justify-center gap-1 shadow-glow"
            >
              <ArrowUpCircle size={14} /> Withdraw
            </button>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-4 flex flex-col justify-center">
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-widest">Escrow Pending Balance</p>
          <h2 className="text-3xl font-black text-indigo-400">₹{(wallet?.pending_balance || 0).toLocaleString()}</h2>
          <p className="text-xxs text-gray-500 leading-normal">
            This balance represents active order funds. When you deliver work and the client accepts, pending funds release instantly to Available Balance.
          </p>
        </div>
      </div>

      {/* Transactions list */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder pb-2.5">
          <History size={16} /> Transaction History statement
        </h3>

        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="p-3.5 bg-slate-900/60 border border-darkBorder rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {t.type === 'credit' ? (
                    <ArrowDownCircle className="text-emerald-400 shrink-0" size={18} />
                  ) : (
                    <ArrowUpCircle className="text-rose-400 shrink-0" size={18} />
                  )}
                  <div>
                    <p className="text-xs font-bold text-white">{t.description}</p>
                    <p className="text-xxs text-gray-500">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-black ${t.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.type === 'credit' ? '+' : '-'} ₹{t.amount.toLocaleString()}
                  </p>
                  <span className="text-xxs text-gray-500 capitalize">{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No transaction logs recorded.</p>
        )}
      </div>

      {/* Deposit Modal */}
      <AnimatePresence>
        {showDepositModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-darkCard border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-darkBorder pb-2.5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Deposit Funds</h3>
                <button onClick={() => setShowDepositModal(false)} className="text-gray-400 hover:text-white font-bold text-sm">Close</button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900/40 text-red-300 text-xs rounded-lg animate-shake">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-900/40 text-emerald-300 text-xs rounded-lg">
                  <CheckCircle size={16} />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleDepositSubmit} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Deposit Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Gateway Option</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMethod('UPI')}
                      className={`py-2 rounded-lg border font-bold text-xxs flex items-center justify-center gap-1.5 transition ${
                        method === 'UPI' ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20' : 'border-darkBorder text-gray-400'
                      }`}
                    >
                      <Smartphone size={14} /> Razorpay UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod('Bank Transfer')}
                      className={`py-2 rounded-lg border font-bold text-xxs flex items-center justify-center gap-1.5 transition ${
                        method === 'Bank Transfer' ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20' : 'border-darkBorder text-gray-400'
                      }`}
                    >
                      <Landmark size={14} /> Stripe Card
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actioning}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold transition text-xs text-white shadow-glow"
                >
                  {actioning ? "Depositing..." : "Complete Deposit"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-darkCard border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-darkBorder pb-2.5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Withdraw Funds</h3>
                <button onClick={() => setShowWithdrawModal(false)} className="text-gray-400 hover:text-white font-bold text-sm">Close</button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900/40 text-red-300 text-xs rounded-lg">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-900/40 text-emerald-300 text-xs rounded-lg">
                  <CheckCircle size={16} />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider block">Withdrawal Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-950 rounded border border-darkBorder text-xxs text-gray-500 leading-normal">
                  Withdrawals clear within minutes and transfer to your registered savings accounts. Max daily limit: ₹2,00,000.
                </div>

                <button
                  type="submit"
                  disabled={actioning}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-xl font-bold transition text-xs text-white shadow-glow"
                >
                  {actioning ? "Processing..." : "Complete Withdrawal"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Wallet;
