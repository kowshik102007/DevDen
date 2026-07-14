'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { schedulerAPI, authAPI } from '@/lib/api';

export default function SchedulerPage() {
  const router = useRouter();
  const [scheduleInput, setScheduleInput] = useState('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUsername = localStorage.getItem('username');
    if (!token || !storedUsername) {
      router.push('/login');
      return;
    }
    setUsername(storedUsername);
    loadSchedules();
  }, [router]);

  const loadSchedules = async () => {
    try {
      const data = await schedulerAPI.listSchedules();
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  };

  const handleGenerateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleInput.trim()) return;

    setLoading(true);
    try {
      await schedulerAPI.generateSchedule(scheduleInput);
      setScheduleInput('');
      await loadSchedules();
      alert('Schedule generated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to generate schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authAPI.logout();
    router.push('/login');
  };

  return (
    <div data-test-id="scheduler-page" className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="glass-effect border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-xl font-bold text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold font-playfair">Scheduler</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">{username}</span>
          <button onClick={handleLogout} className="btn-secondary px-4 py-2" data-test-id="logout-button">
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 glass-effect border-r border-gray-700 p-4" data-test-id="sidebar">
          <nav className="space-y-2">
            <Link href="/dashboard" className="block px-4 py-3 rounded-lg hover:bg-gray-800/50 transition" data-test-id="nav-dashboard">
              🏠 Dashboard
            </Link>
            <Link href="/scheduler" className="block px-4 py-3 rounded-lg bg-indigo-500/20 border border-indigo-500/50 text-indigo-300" data-test-id="nav-scheduler">
              📅 Scheduler
            </Link>
            <Link href="/documents" className="block px-4 py-3 rounded-lg hover:bg-gray-800/50 transition" data-test-id="nav-documents">
              📚 Documents
            </Link>
            <Link href="/activity" className="block px-4 py-3 rounded-lg hover:bg-gray-800/50 transition" data-test-id="nav-activity">
              📊 Activity
            </Link>
            <Link href="/logs" className="block px-4 py-3 rounded-lg hover:bg-gray-800/50 transition" data-test-id="nav-logs">
              📝 Logs
            </Link>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Generate Schedule Form */}
          <div className="glass-effect rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4" data-test-id="generate-schedule-title">Generate New Schedule</h2>
            <form onSubmit={handleGenerateSchedule} data-test-id="schedule-form">
              <textarea
                className="input-field mb-4 min-h-[120px] resize-y"
                placeholder="Describe what you want to learn or accomplish... (e.g., 'Create a 4-week schedule to learn RAG systems, 1 hour per day')"
                value={scheduleInput}
                onChange={(e) => setScheduleInput(e.target.value)}
                data-test-id="schedule-input"
              />
              <button
                type="submit"
                className="btn-primary px-6 py-3"
                disabled={loading || !scheduleInput.trim()}
                data-test-id="generate-schedule-button"
              >
                {loading ? 'Generating...' : '⚙️ Generate Schedule'}
              </button>
            </form>
          </div>

          {/* Schedules List */}
          <div>
            <h2 className="text-xl font-semibold mb-4" data-test-id="schedules-list-title">Your Schedules ({schedules.length})</h2>
            {schedules.length === 0 ? (
              <div className="glass-effect rounded-2xl p-8 text-center text-gray-400" data-test-id="empty-schedules">
                <p className="text-lg">No schedules yet</p>
                <p className="text-sm mt-2">Create your first schedule above!</p>
              </div>
            ) : (
              <div className="grid gap-4" data-test-id="schedules-list">
                {schedules.map((schedule, idx) => (
                  <div key={schedule.id || idx} className="glass-effect rounded-2xl p-6" data-test-id={`schedule-${idx}`}>
                    <h3 className="text-lg font-semibold mb-2" data-test-id={`schedule-title-${idx}`}>
                      {schedule.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4" data-test-id={`schedule-description-${idx}`}>
                      {schedule.description || 'No description'}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        Created: {new Date(schedule.created_at).toLocaleDateString()}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/50">
                        {schedule.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
