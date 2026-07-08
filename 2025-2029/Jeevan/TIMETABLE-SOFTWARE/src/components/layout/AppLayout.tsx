import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Settings, BookOpen, Users, GraduationCap,
  Calendar, Eye, LogOut, Menu, X, ChevronRight, School
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore, useAppStore } from '../../store';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/setup', icon: Settings, label: 'School Setup' },
  { to: '/classes', icon: GraduationCap, label: 'Classes' },
  { to: '/subjects', icon: BookOpen, label: 'Subjects' },
  { to: '/teachers', icon: Users, label: 'Teachers' },
  { to: '/generate', icon: Calendar, label: 'Generate' },
  { to: '/timetable', icon: Eye, label: 'View Timetable' },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, setUser } = useAuthStore();
  const { school } = useAppStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    setUser(null);
    navigate('/');
    toast.success('Logged out successfully');
  };

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 flex-shrink-0 flex flex-col bg-dark-800 border-r border-white/5`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <School size={16} className="text-white" />
              </div>
              <span className="font-display font-bold text-white text-sm">TimetableAI</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* School Info */}
        {sidebarOpen && school && (
          <div className="mx-3 mt-4 p-3 glass rounded-xl">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Active School</p>
            <p className="text-sm font-semibold text-white truncate">{school.name}</p>
            <p className="text-xs text-white/50">{school.academic_year}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'sidebar-link-active' : 'sidebar-link'
              }
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={14} className="opacity-30" />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-3 border-t border-white/5">
          <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0 text-sm font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-dark-900 bg-mesh">
        <div className="max-w-7xl mx-auto p-6 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
