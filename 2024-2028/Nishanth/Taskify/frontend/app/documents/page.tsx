'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { documentsAPI, authAPI } from '@/lib/api';

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUsername = localStorage.getItem('username');
    if (!token || !storedUsername) {
      router.push('/login');
      return;
    }
    setUsername(storedUsername);
    loadDocuments();
  }, [router]);

  const loadDocuments = async () => {
    try {
      const data = await documentsAPI.list();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await documentsAPI.upload(file);
      await loadDocuments();
      alert('Document uploaded successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await authAPI.logout();
    router.push('/login');
  };

  return (
    <div data-test-id="documents-page" className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="glass-effect border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-xl font-bold text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold font-playfair">Documents</h1>
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
            <Link href="/documents" className="block px-4 py-3 rounded-lg bg-indigo-500/20 border border-indigo-500/50 text-indigo-300" data-test-id="nav-documents">
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
          {/* Upload Section */}
          <div className="glass-effect rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4" data-test-id="upload-section-title">Upload New Document</h2>
            <label className="btn-primary px-6 py-3 cursor-pointer inline-block" data-test-id="upload-button">
              {uploading ? 'Uploading...' : '📤 Upload PDF or DOCX'}
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
                data-test-id="file-input"
              />
            </label>
            <p className="text-sm text-gray-400 mt-3">
              Upload documents to generate personalized schedules and learning paths
            </p>
          </div>

          {/* Documents List */}
          <div>
            <h2 className="text-xl font-semibold mb-4" data-test-id="documents-list-title">
              Your Documents ({documents.length})
            </h2>
            {documents.length === 0 ? (
              <div className="glass-effect rounded-2xl p-8 text-center text-gray-400" data-test-id="empty-documents">
                <p className="text-lg">No documents uploaded yet</p>
                <p className="text-sm mt-2">Upload your first document above!</p>
              </div>
            ) : (
              <div className="grid gap-4" data-test-id="document-list">
                {documents.map((doc, idx) => (
                  <div key={doc.batch_id || idx} className="glass-effect rounded-2xl p-6 flex items-center justify-between" data-test-id={`document-${idx}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl">
                        {doc.doc_type === 'pdf' ? '📄' : '📝'}
                      </div>
                      <div>
                        <h3 className="font-semibold" data-test-id={`document-name-${idx}`}>{doc.filename}</h3>
                        <p className="text-sm text-gray-400">
                          Uploaded: {new Date(doc.upload_time).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/50">
                      {doc.doc_type.toUpperCase()}
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
