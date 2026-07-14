'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI, schedulerAPI } from '@/lib/api';

export default function ActivityPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUsername = localStorage.getItem('username');
    if (!token || !storedUsername) {
      router.push('/login');
      return;
    }
    setUsername(storedUsername);
    loadActivity();
  }, [router]);

  const loadActivity = async () => {
    try {
      const history = await schedulerAPI.getChatHistory();
      setChatHistory(history);
    } catch (err) {
      console.error('Failed to load activity:', err);
    }
  };

  const handleLogout = async () => {
    await authAPI.logout();
    router.push('/login');
  };

  return (
    <div data-test-id="activity-page" className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="glass-effect border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-xl font-bold text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold font-playfair">Activity History</h1>
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
            <Link href="/scheduler" className="block px-4 py-3 rounded-lg hover:bg-gray-800/50 transition" data-test-id="nav-scheduler">
              📅 Scheduler
            </Link>
            <Link href="/documents" className="block px-4 py-3 rounded-lg hover:bg-gray-800/50 transition" data-test-id="nav-documents">
              📚 Documents
            </Link>
            <Link href="/activity" className="block px-4 py-3 rounded-lg bg-indigo-500/20 border border-indigo-500/50 text-indigo-300" data-test-id="nav-activity">
              📊 Activity
            </Link>
            <Link href="/logs" className="block px-4 py-3 rounded-lg hover:bg-gray-800/50 transition" data-test-id="nav-logs">
              📝 Logs
            </Link>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4" data-test-id="activity-title">Recent Activity</h2>
          
          {chatHistory.length === 0 ? (
            <div className="glass-effect rounded-2xl p-8 text-center text-gray-400" data-test-id="empty-activity">
              <p className="text-lg">No activity yet</p>
              <p className="text-sm mt-2">Start chatting on the dashboard to see your activity here!</p>
            </div>
          ) : (
            <div className="space-y-4" data-test-id="activity-list">
              {chatHistory.map((item, idx) => (
                <div key={idx} className="glass-effect rounded-2xl p-6" data-test-id={`activity-item-${idx}`}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm text-gray-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-indigo-400 font-medium mb-1">You asked:</div>
                      <div className="text-gray-300">{item.user_message}</div>
                    </div>
                    {item.bot_response && (
                      <div>
                        <div className="text-sm text-purple-400 font-medium mb-1">AI responded:</div>
                        <div className="text-gray-400 text-sm">{item.bot_response.message}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
