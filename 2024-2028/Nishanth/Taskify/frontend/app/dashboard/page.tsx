'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI, schedulerAPI, documentsAPI } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('access_token');
    const storedUsername = localStorage.getItem('username');
    if (!token || !storedUsername) {
      router.push('/login');
      return;
    }
    setUsername(storedUsername);
    loadChatHistory();
  }, [router]);

  const loadChatHistory = async () => {
    try {
      const history = await schedulerAPI.getChatHistory();
      setChatMessages(history);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setLoading(true);

    // Add user message to UI immediately
    setChatMessages(prev => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        user_message: userMessage,
        bot_response: null
      }
    ]);

    try {
      const response = await schedulerAPI.chat(userMessage, 'chat');
      setChatMessages(prev => [
        ...prev.slice(0, -1),
        {
          timestamp: new Date().toISOString(),
          user_message: userMessage,
          bot_response: response
        }
      ]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      await documentsAPI.upload(file);
      alert('Document uploaded successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } finally {
      router.push('/login');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div data-test-id="dashboard" className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="glass-effect border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-xl font-bold text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold font-playfair" data-test-id="dashboard-title">Taskify Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400" data-test-id="username-display">Welcome, {username}!</span>
          <button
            onClick={handleLogout}
            className="btn-secondary px-4 py-2"
            data-test-id="logout-button"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 glass-effect border-r border-gray-700 p-4" data-test-id="sidebar">
          <nav className="space-y-2">
            <Link href="/dashboard" className="block px-4 py-3 rounded-lg bg-indigo-500/20 border border-indigo-500/50 text-indigo-300" data-test-id="nav-dashboard">
              🏠 Dashboard
            </Link>
            <Link href="/scheduler" className="block px-4 py-3 rounded-lg hover:bg-gray-800/50 transition" data-test-id="nav-scheduler">
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

        {/* Chat Area */}
        <div className="flex-1 flex flex-col p-6">
          <div className="glass-effect rounded-2xl flex-1 flex flex-col p-6">
            {/* Chat Header */}
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold" data-test-id="chat-title">AI Assistant</h2>
              <label className="btn-primary px-4 py-2 cursor-pointer" data-test-id="upload-document-button">
                {uploadingDoc ? 'Uploading...' : '📤 Upload Document'}
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleDocumentUpload}
                  className="hidden"
                  disabled={uploadingDoc}
                  data-test-id="document-upload-input"
                />
              </label>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-4" data-test-id="chat-messages">
              {chatMessages.length === 0 && (
                <div className="text-center text-gray-400 mt-8" data-test-id="empty-chat-message">
                  <p className="text-lg mb-2">👋 Hello! I'm your AI assistant.</p>
                  <p>Ask me anything about task management, scheduling, or productivity!</p>
                </div>
              )}
              
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="space-y-2">
                  {/* User Message */}
                  <div className="flex justify-end" data-test-id={`user-message-${idx}`}>
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-4 py-3 rounded-2xl max-w-2xl text-white">
                      {msg.user_message}
                    </div>
                  </div>
                  
                  {/* Bot Response */}
                  {msg.bot_response && (
                    <div className="flex justify-start" data-test-id={`bot-message-${idx}`}>
                      <div className="glass-effect px-4 py-3 rounded-2xl max-w-2xl">
                        {msg.bot_response.message}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start" data-test-id="loading-indicator">
                  <div className="glass-effect px-4 py-3 rounded-2xl">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="flex gap-3" data-test-id="chat-input-form">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
                data-test-id="chat-input"
              />
              <button
                type="submit"
                className="btn-primary px-6"
                disabled={loading || !inputMessage.trim()}
                data-test-id="send-message-button"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
