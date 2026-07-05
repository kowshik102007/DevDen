import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  CreditCard, Smartphone, Wallet as WalletIcon, CheckCircle2, 
  AlertCircle, Lock, ArrowRight, ShieldCheck, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Checkout = () => {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('service_id');
  const packageName = searchParams.get('package') || 'basic';
  
  const { user, token, refreshUser } = useAuth();
  const navigate = useNavigate();

  // State
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Credit Card'); // 'Credit Card', 'UPI', 'Wallet'
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Card input mock states
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  useEffect(() => {
    if (!serviceId) return;
    const fetchService = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/services/${serviceId}`);
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
  }, [serviceId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 animate-pulse space-y-6">
        <div className="h-10 w-1/3 bg-darkCard border border-darkBorder rounded" />
        <div className="h-60 bg-darkCard border border-darkBorder rounded" />
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <AlertCircle className="text-red-400 mx-auto" size={44} />
        <h2 className="text-xl font-bold text-white">Invalid Checkout Link</h2>
        <Link to="/marketplace" className="text-indigo-400 font-semibold hover:underline">Return to Marketplace</Link>
      </div>
    );
  }

  const pkg = gig.packages[packageName] || gig.packages.basic;
  const price = pkg.price;

  const handlePay = async (e) => {
    e.preventDefault();
    setError('');
    
    if (paymentMethod === 'Wallet') {
      const walletBal = user.wallet?.balance || 0;
      if (walletBal < price) {
        setError("Insufficient wallet balance. Please deposit funds first.");
        return;
      }
    }
    
    setPaying(true);
    
    try {
      // 1. Create order
      const orderRes = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service_id: gig.id,
          requirements: `Requirements for ${pkg.name} package`
        })
      });
      
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Order creation failed");
      
      // 2. Process mock payment checkout
      const checkRes = await fetch('http://localhost:5000/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: orderData.order.id,
          method: paymentMethod
        })
      });
      
      const checkData = await checkRes.json();
      if (!checkRes.ok) throw new Error(checkData.error || "Payment checkout failed");
      
      // Success triggers!
      setSuccess(true);
      await refreshUser(); // update wallet balance in client UI
      
      // Redirect after 2.5 seconds
      setTimeout(() => {
        navigate('/orders');
      }, 2500);
      
    } catch (err) {
      setError(err.message || "An error occurred during checkout processing.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8 relative">
      <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      <h1 className="text-2xl md:text-3xl font-extrabold text-white font-sans">Payment Checkout</h1>

      {success ? (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-panel p-12 max-w-xl mx-auto text-center space-y-6 shadow-2xl border-emerald-500/30"
        >
          <CheckCircle2 className="text-emerald-400 mx-auto animate-bounce" size={54} />
          <h2 className="text-2xl font-black text-white">Payment Authorized!</h2>
          <p className="text-sm text-gray-300">
            Escrow amount of <span className="text-cyan-400 font-bold">₹{price.toLocaleString()}</span> has been safely locked. Redirection active...
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Payment choice */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-300 text-xs">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Selector tabs */}
            <div className="glass-panel p-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('Credit Card')}
                className={`py-3 rounded-xl border flex flex-col items-center gap-2 transition text-xs font-bold ${
                  paymentMethod === 'Credit Card'
                    ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400'
                    : 'bg-slate-900/40 border-darkBorder text-gray-400 hover:border-slate-800'
                }`}
              >
                <CreditCard size={18} />
                <span>Stripe Card</span>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`py-3 rounded-xl border flex flex-col items-center gap-2 transition text-xs font-bold ${
                  paymentMethod === 'UPI'
                    ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400'
                    : 'bg-slate-900/40 border-darkBorder text-gray-400 hover:border-slate-800'
                }`}
              >
                <Smartphone size={18} />
                <span>Razorpay UPI</span>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('Wallet')}
                className={`py-3 rounded-xl border flex flex-col items-center gap-2 transition text-xs font-bold ${
                  paymentMethod === 'Wallet'
                    ? 'bg-indigo-950/40 border-indigo-500 text-indigo-400'
                    : 'bg-slate-900/40 border-darkBorder text-gray-400 hover:border-slate-800'
                }`}
              >
                <WalletIcon size={18} />
                <span>Escrow Wallet</span>
              </button>
            </div>

            {/* Payment Details form panel */}
            <div className="glass-panel p-6">
              <form onSubmit={handlePay} className="space-y-6">
                
                {paymentMethod === 'Credit Card' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">Cardholder Name</label>
                      <input 
                        type="text" 
                        placeholder="John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">Card Number</label>
                      <input 
                        type="text" 
                        placeholder="4242 4242 4242 4242"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">Expiry Date</label>
                        <input 
                          type="text" 
                          placeholder="MM/YY"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white text-center"
                          required
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xxs font-semibold text-gray-400 uppercase tracking-wider">CVV Code</label>
                        <input 
                          type="text" 
                          placeholder="•••"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                          className="w-full bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white text-center"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'UPI' && (
                  <div className="text-center p-6 space-y-4">
                    <QrCode size={120} className="mx-auto text-indigo-400 bg-white p-2 rounded-xl" />
                    <p className="text-xs text-gray-300">Scan QR Code using any UPI App (GPay, PhonePe, Paytm)</p>
                    <div className="text-xxs text-gray-500 bg-slate-950/60 p-2 rounded border border-darkBorder inline-block">
                      Merchant: SkillBridge Escrow Services Private Ltd.
                    </div>
                  </div>
                )}

                {paymentMethod === 'Wallet' && (
                  <div className="p-4 bg-slate-900 border border-darkBorder rounded-xl space-y-3">
                    <div className="flex justify-between text-xs text-gray-300">
                      <span>Available Wallet Balance</span>
                      <span className="font-extrabold text-white">₹{(user.wallet?.balance || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-300">
                      <span>Order Value Amount</span>
                      <span className="font-extrabold text-cyan-400">₹{price.toFixed(2)}</span>
                    </div>
                    
                    {user.wallet?.balance < price && (
                      <div className="pt-2 border-t border-darkBorder/40 text-xxs text-rose-400 flex items-center gap-1.5">
                        <AlertCircle size={14} /> Balance is insufficient. Navigate to Wallet studio to deposit.
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={paying || (paymentMethod === 'Wallet' && (user.wallet?.balance || 0) < price)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 py-3.5 rounded-xl font-bold transition text-xs text-white flex items-center justify-center gap-1.5 shadow-glow"
                >
                  {paying ? "Processing Escrow..." : `Pay ₹${price.toLocaleString()}`}
                  {!paying && <ArrowRight size={14} />}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="glass-panel p-6 space-y-5">
            <h3 className="text-sm font-bold text-white border-b border-darkBorder pb-2.5 uppercase tracking-wider">Order Summary</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest">{gig.category}</p>
                <h4 className="text-sm font-bold text-white leading-snug">{gig.title}</h4>
              </div>
              
              <div className="p-3 bg-slate-900/60 rounded-xl space-y-2 border border-darkBorder text-xxs text-gray-300">
                <div className="flex justify-between">
                  <span>Package tier:</span>
                  <span className="font-bold text-indigo-400 uppercase">{packageName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery timeline:</span>
                  <span className="font-bold text-white">{pkg.delivery} Days</span>
                </div>
              </div>
              
              <div className="border-t border-darkBorder pt-3 flex justify-between items-center text-sm font-black text-white">
                <span>Total Amount:</span>
                <span className="text-cyan-400">₹{price.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="border-t border-darkBorder/40 pt-4 text-xxs text-gray-500 flex items-center gap-1.5 justify-center">
              <ShieldCheck className="text-emerald-400 shrink-0" size={14} /> Verified Gateway Secure payment
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Checkout;
