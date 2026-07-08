import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SchoolSetup from './pages/SchoolSetup';
import ClassManagement from './pages/ClassManagement';
import SubjectManagement from './pages/SubjectManagement';
import TeacherManagement from './pages/TeacherManagement';
import TimetableGenerator from './pages/TimetableGenerator';
import TimetableView from './pages/TimetableView';
import AdminDashboard from './pages/AdminDashboard';
import AppLayout from './components/layout/AppLayout';
import { useAuthStore } from './store';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1c1f35',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />

        {/* Protected App Routes */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup" element={<SchoolSetup />} />
          <Route path="/classes" element={<ClassManagement />} />
          <Route path="/subjects" element={<SubjectManagement />} />
          <Route path="/teachers" element={<TeacherManagement />} />
          <Route path="/generate" element={<TimetableGenerator />} />
          <Route path="/timetable" element={<TimetableView />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
