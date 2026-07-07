import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  User as UserIcon, 
  Lock, 
  Bell, 
  CreditCard, 
  Cpu, 
  CheckCircle, 
  AlertTriangle 
} from 'lucide-react';

export function Settings() {
  const { user, token, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile state
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [isTwoFactor, setIsTwoFactor] = useState(user?.is_two_factor_enabled || false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  // Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  // Mock Notification settings
  const [emailOrders, setEmailOrders] = useState(true);
  const [emailMessages, setEmailMessages] = useState(true);
  const [emailSecurity, setEmailSecurity] = useState(true);
  const [notifMsg, setNotifMsg] = useState('');

  // Mock Payout state
  const [payoutMethod, setPayoutMethod] = useState('Bank Transfer');
  const [payoutEmail, setPayoutEmail] = useState(user?.email || '');
  const [payoutMsg, setPayoutMsg] = useState('');

  // Mock AI state
  const [atsThreshold, setAtsThreshold] = useState(75);
  const [autoMatchGigs, setAutoMatchGigs] = useState(true);
  const [aiMsg, setAiMsg] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    try {
      const res = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          is_two_factor_enabled: isTwoFactor
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMsg('Profile settings saved successfully.');
        refreshUser();
      } else {
        setProfileErr(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileErr('Failed to connect to backend.');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    if (newPw !== confirmPw) {
      setPwErr('New passwords do not match.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPw,
          new_password: newPw
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg('Password updated successfully.');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        setPwErr(data.error || 'Failed to change password.');
      }
    } catch (err) {
      setPwErr('Server connection failed.');
    }
  };

  const handleSaveNotifications = (e) => {
    e.preventDefault();
    setNotifMsg('Notification preferences updated.');
    setTimeout(() => setNotifMsg(''), 3000);
  };

  const handleSavePayouts = (e) => {
    e.preventDefault();
    setPayoutMsg('Payout configurations updated.');
    setTimeout(() => setPayoutMsg(''), 3000);
  };

  const handleSaveAI = (e) => {
    e.preventDefault();
    setAiMsg('AI heuristics updated.');
    setTimeout(() => setAiMsg(''), 3000);
  };

  const tabs = [
    { id: 'profile', name: 'Profile Account', icon: UserIcon },
    { id: 'security', name: 'Security & Access', icon: Lock },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'billing', name: 'Payout Methods', icon: CreditCard },
    { id: 'ai', name: 'AI Customization', icon: Cpu },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your personal preferences, escrow payout tools, and AI helpers.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Navigation Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-950/50 text-indigo-400 border border-indigo-950/60'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Settings Detail Section */}
        <div className="flex-1 glass-panel p-6 bg-white min-h-[400px]">
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Profile Account</h3>
                <p className="text-sm text-gray-500 mb-6">Manage your primary account details and user verification settings.</p>
              </div>

              {profileMsg && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {profileMsg}
                </div>
              )}

              {profileErr && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {profileErr}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200"
                />
                <span className="text-xs text-gray-400 mt-1 block">Account emails cannot be modified to maintain double-entry audit safety.</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform Marketplace Role</label>
                <div className="inline-block px-3 py-1 bg-gray-100 border text-gray-700 text-xs font-semibold rounded-full capitalize">
                  {user?.role}
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTwoFactor}
                    onChange={(e) => setIsTwoFactor(e.target.checked)}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Enable Two-Factor Authentication (2FA)</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Secure your checkout wallet ledger with additional identity clearance stages.</span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Security & Access</h3>
                <p className="text-sm text-gray-500 mb-6">Modify your sign-in password and update account security tokens.</p>
              </div>

              {pwMsg && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {pwMsg}
                </div>
              )}

              {pwErr && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {pwErr}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="pt-4 border-t">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Update Password
                </button>
              </div>
            </form>
          )}

          {activeTab === 'notifications' && (
            <form onSubmit={handleSaveNotifications} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Notification Preferences</h3>
                <p className="text-sm text-gray-500 mb-6">Manage how and when you receive automated updates and email receipts.</p>
              </div>

              {notifMsg && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {notifMsg}
                </div>
              )}

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailOrders}
                    onChange={(e) => setEmailOrders(e.target.checked)}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Order Updates & Escrow releases</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Receive immediate notices on gig purchases, deliveries, and fund clearance.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailMessages}
                    onChange={(e) => setEmailMessages(e.target.checked)}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Real-Time Messages notifications</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Receive reminders when contractors or clients send you workspace messages.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailSecurity}
                    onChange={(e) => setEmailSecurity(e.target.checked)}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Security & Ledger audits</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Receive instant alerts on password modifications and withdrawal requests.</span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Save Preferences
                </button>
              </div>
            </form>
          )}

          {activeTab === 'billing' && (
            <form onSubmit={handleSavePayouts} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">Payout Configurations</h3>
                <p className="text-sm text-gray-500 mb-6">Manage billing parameters and configure your destination withdraw routes.</p>
              </div>

              {payoutMsg && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {payoutMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Withdrawal Channel</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg"
                >
                  <option value="Bank Transfer">Direct Wire / Local Bank Transfer</option>
                  <option value="PayPal">PayPal Business Address</option>
                  <option value="Stripe Payout">Stripe Connected Express Account</option>
                  <option value="Razorpay">Razorpay Checkout Wallet ID</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payout Verification Email</label>
                <input
                  type="email"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-400 mt-1 block">Account payouts must use email identities matching secondary security clearances.</span>
              </div>

              <div className="pt-4 border-t">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Save Payout Details
                </button>
              </div>
            </form>
          )}

          {activeTab === 'ai' && (
            <form onSubmit={handleSaveAI} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">AI Customization</h3>
                <p className="text-sm text-gray-500 mb-6">Configure thresholds and filters for ATS matching and gig auto-recommendations.</p>
              </div>

              {aiMsg && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {aiMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target ATS Match Score ({atsThreshold}%)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="50"
                    max="95"
                    value={atsThreshold}
                    onChange={(e) => setAtsThreshold(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-900 shrink-0">{atsThreshold}%</span>
                </div>
                <span className="text-xs text-gray-400 mt-1 block">The minimum grade score needed to clear your resume for recommended project matches.</span>
              </div>

              <div className="border-t pt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoMatchGigs}
                    onChange={(e) => setAutoMatchGigs(e.target.checked)}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-700">Automate Gig matches on Login</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Let the collaborative recommendation engine recalculate your suggestions based on category updates automatically.</span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Save AI Preferences
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
