import { useState } from 'react';
import { School, CreditCard, Users, BarChart3, Download, Shield, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

// Mock admin data
const mockSchools = [
  { id: '1', name: 'GHSS Trivandrum', classes: 12, teachers: 28, timetables: 3, status: 'active' },
  { id: '2', name: "St. Mary's HSS Kochi", classes: 18, teachers: 35, timetables: 5, status: 'active' },
  { id: '3', name: 'NSS HSS Palakkad', classes: 8, teachers: 20, timetables: 2, status: 'active' },
  { id: '4', name: 'Govt Model HSS Kozhikode', classes: 15, teachers: 30, timetables: 4, status: 'active' },
];

const mockPayments = [
  { id: 'P001', school: 'GHSS Trivandrum', amount: 20, date: '2024-01-15', status: 'success', method: 'UPI' },
  { id: 'P002', school: "St. Mary's HSS Kochi", amount: 20, date: '2024-01-14', status: 'success', method: 'PhonePe' },
  { id: 'P003', school: 'NSS HSS Palakkad', amount: 20, date: '2024-01-13', status: 'success', method: 'Google Pay' },
  { id: 'P004', school: 'Demo School', amount: 20, date: '2024-01-12', status: 'pending', method: 'Razorpay' },
];

export default function AdminDashboard() {
  const { setUser } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'payments'>('overview');

  const totalRevenue = mockPayments.filter(p => p.status === 'success').reduce((acc, p) => acc + p.amount, 0);

  const handleLogout = () => {
    setUser(null);
    navigate('/');
    toast.success('Logged out');
  };

  return (
    <div className="min-h-screen bg-dark-900 bg-mesh text-white">
      {/* Navbar */}
      <nav className="border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <span className="font-display font-bold">Admin Dashboard</span>
          <span className="badge-warning text-xs">Admin Only</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/50 hover:text-white">
          <LogOut size={16} />
          Logout
        </button>
      </nav>

      <div className="max-w-7xl mx-auto p-6 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Schools', value: mockSchools.length, icon: School, color: 'from-blue-500 to-cyan-500' },
            { label: 'Total Revenue', value: `₹${totalRevenue}`, icon: CreditCard, color: 'from-green-500 to-emerald-500' },
            { label: 'Total Payments', value: mockPayments.length, icon: BarChart3, color: 'from-purple-500 to-pink-500' },
            { label: 'Active Users', value: mockSchools.length, icon: Users, color: 'from-orange-500 to-red-500' },
          ].map(stat => (
            <div key={stat.label} className="stat-card">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                <stat.icon size={20} className="text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-white/50 text-xs">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-dark-800 rounded-xl mb-6 w-fit">
          {(['overview', 'schools', 'payments'] as const).map(tab => (
            <button
              key={tab}
              id={`admin-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
            <div className="card">
              <h2 className="font-semibold text-white mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {mockPayments.slice(0, 4).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-white/3 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-white">{p.school}</p>
                      <p className="text-xs text-white/40">{p.date} · {p.method}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">₹{p.amount}</p>
                      <span className={`badge text-xs ${p.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="font-semibold text-white mb-4">Revenue Summary</h2>
              <div className="space-y-4">
                <div className="flex justify-between p-3 bg-white/3 rounded-xl">
                  <span className="text-white/60">Today</span>
                  <span className="font-bold text-white">₹20</span>
                </div>
                <div className="flex justify-between p-3 bg-white/3 rounded-xl">
                  <span className="text-white/60">This Week</span>
                  <span className="font-bold text-white">₹{totalRevenue}</span>
                </div>
                <div className="flex justify-between p-3 bg-white/3 rounded-xl">
                  <span className="text-white/60">This Month</span>
                  <span className="font-bold text-white">₹{totalRevenue}</span>
                </div>
                <div className="flex justify-between p-3 bg-primary-500/10 border border-primary-500/20 rounded-xl">
                  <span className="text-primary-300 font-medium">Total Revenue</span>
                  <span className="font-bold text-primary-300 text-lg">₹{totalRevenue}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schools Tab */}
        {activeTab === 'schools' && (
          <div className="glass rounded-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-semibold text-white">Registered Schools</h2>
              <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                <Download size={14} />
                Export CSV
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">School</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Classes</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Teachers</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Timetables</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockSchools.map((school, i) => (
                  <tr key={school.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                    <td className="px-4 py-3 font-medium text-white">{school.name}</td>
                    <td className="px-4 py-3 text-center text-white/70">{school.classes}</td>
                    <td className="px-4 py-3 text-center text-white/70">{school.teachers}</td>
                    <td className="px-4 py-3 text-center text-white/70">{school.timetables}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="badge-success text-xs">Active</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="btn-danger text-xs py-1 px-2">Disable</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="glass rounded-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-semibold text-white">Payment Records</h2>
              <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                <Download size={14} />
                Export CSV
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">School</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Method</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-white/60 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockPayments.map((p, i) => (
                  <tr key={p.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                    <td className="px-4 py-3 text-xs font-mono text-white/50">{p.id}</td>
                    <td className="px-4 py-3 text-sm text-white">{p.school}</td>
                    <td className="px-4 py-3 text-center font-bold text-white">₹{p.amount}</td>
                    <td className="px-4 py-3 text-center text-white/60 text-sm">{p.date}</td>
                    <td className="px-4 py-3 text-center text-white/60 text-sm">{p.method}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge text-xs ${p.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
