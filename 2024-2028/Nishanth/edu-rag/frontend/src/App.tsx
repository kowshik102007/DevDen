import { useState, useEffect } from 'react';
import { Uploader } from './components/Uploader';
import { DocumentList } from './components/DocumentList';
import { InteractiveTree } from './components/InteractiveTree';
import type { TreeNodeData } from './components/InteractiveTree';
import { ChatConsole } from './components/ChatConsole';
import type { Message } from './components/ChatConsole';
import { NodeViewer } from './components/NodeViewer';
import { FileText, Database, Workflow, Search, X, MessageSquare } from 'lucide-react';
import './App.css';

interface Document {
  doc_id: string;
  filename: string;
  status: string;
  uploaded_at: number;
  has_tree: boolean;
}

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDocDetails, setActiveDocDetails] = useState<any | null>(null);
  
  // RAG States
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // UI states
  const [selectedNode, setSelectedNode] = useState<TreeNodeData | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showTreePanel, setShowTreePanel] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(true);
  
  // Indexing progress state (simulated polling loader)
  const [indexingProgress, setIndexingProgress] = useState(0);

  useEffect(() => {
    const activeDocInList = documents.find(d => d.doc_id === activeDocId);
    const currentStatus = activeDocDetails?.status || activeDocInList?.status;
    
    if (currentStatus !== 'processing') {
      setIndexingProgress(0);
      return;
    }
    
    setIndexingProgress(prev => (prev === 0 ? 5 : prev));
    
    const interval = setInterval(() => {
      setIndexingProgress(prev => {
        if (prev < 60) {
          return prev + Math.floor(Math.random() * 6) + 4; // +4 to +9
        } else if (prev < 90) {
          return prev + Math.floor(Math.random() * 3) + 1; // +1 to +3
        } else if (prev < 98) {
          return prev + (Math.random() > 0.6 ? 1 : 0); // +0 or +1
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeDocDetails?.status, activeDocId, documents]);


  // Fetch document list on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll for processing documents
  useEffect(() => {
    const hasProcessing = documents.some(doc => doc.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
      // If we currently have an active document selected and it is processing, update its details too
      if (activeDocId) {
        const activeDoc = documents.find(d => d.doc_id === activeDocId);
        if (activeDoc && activeDoc.status === 'processing') {
          fetchActiveDocDetails(activeDocId);
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [documents, activeDocId]);

  // Load details when active document changes
  useEffect(() => {
    if (activeDocId) {
      fetchActiveDocDetails(activeDocId);
      // Reset highlights, outline search filter, and panel visibilities when changing document
      setHighlightedNodeIds([]);
      setSearchFilter('');
      setShowTreePanel(true);
      setShowChatPanel(true);
    } else {
      setActiveDocDetails(null);
      setHighlightedNodeIds([]);
      setSearchFilter('');
    }
  }, [activeDocId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/v1/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const fetchActiveDocDetails = async (docId: string) => {
    try {
      const response = await fetch(`/api/v1/documents/${docId}`);
      if (response.ok) {
        const data = await response.json();
        setActiveDocDetails(data);
      }
    } catch (error) {
      console.error(`Error fetching document details for ${docId}:`, error);
    }
  };

  const handleUploadSuccess = (uploadedDoc: any) => {
    fetchDocuments();
    setActiveDocId(uploadedDoc.doc_id);
  };

  const handleSelectDocument = (docId: string) => {
    setActiveDocId(docId);
  };

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this document and its tree from the workspace registry?")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/v1/documents/${docId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        if (activeDocId === docId) {
          setActiveDocId(null);
        }
        
        setMessagesMap(prev => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
        
        fetchDocuments();
      } else {
        const errorData = await response.json();
        alert(`Failed to delete document: ${errorData.detail || "Server error"}`);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to connect to the backend to delete document.");
    }
  };

  const handleSendMessage = async (query: string) => {
    if (!activeDocId || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
    };

    const pendingAssistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'assistant',
      text: '',
      isPending: true
    };

    const currentDocMessages = messagesMap[activeDocId] || [];
    const updatedMessages = [...currentDocMessages, userMessage, pendingAssistantMessage];
    
    setMessagesMap(prev => ({
      ...prev,
      [activeDocId]: updatedMessages
    }));

    setIsGenerating(true);

    try {
      const response = await fetch(`/api/v1/documents/${activeDocId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "RAG pipeline failed to answer");
      }

      const result = await response.json();
      
      // Update highlighted nodes in tree
      const nodeIds = result.node_list || [];
      setHighlightedNodeIds(nodeIds);

      const responseMessage: Message = {
        id: (Date.now() + 2).toString(),
        sender: 'assistant',
        text: result.answer,
        thinking: result.thinking,
        nodeList: nodeIds
      };

      setMessagesMap(prev => ({
        ...prev,
        [activeDocId]: [...currentDocMessages, userMessage, responseMessage]
      }));

    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        sender: 'assistant',
        text: `Error: ${error.message || "Failed to generate answer. Please try again."}`
      };
      setMessagesMap(prev => ({
        ...prev,
        [activeDocId]: [...currentDocMessages, userMessage, errorMessage]
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to recursively find a node by its section title in the document tree
  const findNodeByTitle = (nodes: TreeNodeData[], title: string): TreeNodeData | null => {
    for (const node of nodes) {
      if (node.title.toLowerCase().trim() === title.toLowerCase().trim()) {
        return node;
      }
      if (node.nodes) {
        const found = findNodeByTitle(node.nodes, title);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper to recursively find a node by its ID in the document tree
  const findNodeById = (nodes: TreeNodeData[], nodeId: string): TreeNodeData | null => {
    const paddedTarget = nodeId.padStart(4, '0');
    for (const node of nodes) {
      if (node.node_id.trim() === paddedTarget || node.node_id.trim() === nodeId.trim()) {
        return node;
      }
      if (node.nodes) {
        const found = findNodeById(node.nodes, nodeId);
        if (found) return found;
      }
    }
    return null;
  };

  const handleCitationClick = (identifier: string) => {
    if (!activeDocDetails || !activeDocDetails.tree) return;

    let matchedNode: TreeNodeData | null = null;
    const cleanId = identifier.trim();

    // 1. Try finding by direct title
    matchedNode = findNodeByTitle(activeDocDetails.tree, cleanId);

    // 2. Try finding by direct ID
    if (!matchedNode && /^\d+$/.test(cleanId)) {
      matchedNode = findNodeById(activeDocDetails.tree, cleanId);
    }

    // 3. Try parsing pattern like "Node 0007"
    if (!matchedNode) {
      const nodeMatch = cleanId.match(/Node\s+(\d+)/i);
      if (nodeMatch) {
        matchedNode = findNodeById(activeDocDetails.tree, nodeMatch[1]);
      }
    }

    if (matchedNode) {
      // 1. Set selected node to open drawer details
      setSelectedNode(matchedNode);

      // 2. Highlight/Scroll the tree element into view
      setTimeout(() => {
        const element = document.getElementById(`tree-node-${matchedNode.node_id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlighted');
          // Remove highlight class after a short duration
          setTimeout(() => {
            element.classList.remove('highlighted');
          }, 2500);
        }
      }, 100);
    } else {
      console.warn(`Could not find section node with identifier: "${identifier}"`);
    }
  };

  const activeMessages = activeDocId ? (messagesMap[activeDocId] || []) : [];

  const activeDocInRegistry = documents.find(d => d.doc_id === activeDocId);
  const activeDocName = activeDocDetails?.filename || activeDocInRegistry?.filename || 'Document';
  const isDocProcessing = activeDocDetails?.status === 'processing' || activeDocInRegistry?.status === 'processing';
  const isDocFailed = activeDocDetails?.status === 'failed' || activeDocInRegistry?.status === 'failed';

  return (
    <>
      <header className="app-header">
        <div className="logo-container">
          <Workflow size={16} style={{ color: 'var(--accent-primary)' }} />
          <span className="logo-text" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, letterSpacing: '-0.3px', marginLeft: '4px' }}>structur.io</span>
          <span className="logo-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>v0.1.0-mvp</span>
        </div>
        <div className="header-meta">
          <div className="meta-status">
            <span className="status-dot" style={{ backgroundColor: 'var(--status-completed)' }}></span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>gemini-3.1-flash-lite • active</span>
          </div>
        </div>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <div>
            <div className="section-title">Upload Documents</div>
            <Uploader onUploadSuccess={handleUploadSuccess} />
          </div>

          <div>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Registry Docs</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activeDocId && (
                  <button 
                    onClick={() => setActiveDocId(null)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: 'var(--status-failed)',
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      marginRight: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'var(--transition)'
                    }}
                    title="Close active document workspace"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                    }}
                  >
                    Close Workspace
                  </button>
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({documents.length})</span>
              </div>
            </div>
            <DocumentList 
              documents={documents} 
              activeDocId={activeDocId} 
              onSelectDocument={handleSelectDocument} 
              onDeleteDocument={handleDeleteDocument}
            />
          </div>
        </aside>

        <main className="workspace">
          {!activeDocId ? (
            <div className="empty-state">
              <div className="empty-state-card">
                <div className="empty-state-icon">
                  <FileText size={24} />
                </div>
                <h2 className="empty-state-title">Select a document to start</h2>
                <p className="empty-state-desc">
                  Upload a PDF in the sidebar and select it to inspect its structural tree hierarchy and ask targeted questions.
                </p>
              </div>
            </div>
          ) : isDocProcessing ? (
            <div className="empty-state">
              <div className="empty-state-card" style={{ position: 'relative', width: '100%', maxWidth: '420px', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <button 
                  onClick={() => setActiveDocId(null)}
                  className="close-btn"
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                  title="Close and return to dashboard"
                >
                  <X size={13} />
                </button>
                <div className="empty-state-icon" style={{ animation: 'spin 3s linear infinite', color: 'var(--accent-cyan)' }}>
                  <Database size={24} />
                </div>
                <h2 className="empty-state-title" style={{ textAlign: 'center' }}>Analyzing document structure</h2>
                <p className="empty-state-desc" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Indexing the structural outline of <strong>{activeDocName}</strong>. This usually takes about 15-30 seconds.
                </p>
                
                {/* Sleek, Glowing Animated Progress Bar */}
                <div style={{ width: '100%', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Structuring outline nodes...</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{indexingProgress}%</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'var(--border-default)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: `${indexingProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-cyan) 100%)',
                      borderRadius: '3px',
                      transition: 'width 0.4s cubic-bezier(0.1, 0.8, 0.2, 1)',
                      boxShadow: '0 0 10px rgba(0, 229, 255, 0.4)'
                    }}></div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveDocId(null)}
                  style={{
                    marginTop: '8px',
                    background: 'transparent',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Cancel Indexing View
                </button>
              </div>
            </div>
          ) : isDocFailed ? (
            <div className="empty-state">
              <div className="empty-state-card" style={{ position: 'relative', width: '100%', maxWidth: '420px', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <button 
                  onClick={() => setActiveDocId(null)}
                  className="close-btn"
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                  title="Close and return to dashboard"
                >
                  <X size={13} />
                </button>
                <div className="empty-state-icon" style={{ borderColor: 'var(--status-failed)', color: 'var(--status-failed)' }}>
                  <FileText size={24} />
                </div>
                <h2 className="empty-state-title" style={{ textAlign: 'center' }}>Unable to index document</h2>
                <p className="empty-state-desc" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  An error occurred while compiling the hierarchy outline for this PDF. Details:
                  <code style={{ marginTop: '10px', color: 'var(--status-failed)', display: 'block', padding: '6px', fontSize: '11px', background: 'var(--bg-hover)', borderRadius: '4px', border: '1px solid var(--border-default)', fontFamily: 'var(--font-mono)', textAlign: 'left', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                    {activeDocDetails?.error || "Invalid file format or parsing error."}
                  </code>
                </p>
                <button
                  onClick={() => setActiveDocId(null)}
                  style={{
                    marginTop: '8px',
                    background: 'transparent',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : !showTreePanel && !showChatPanel ? (
            <div className="empty-state">
              <div className="empty-state-card" style={{ textAlign: 'center', maxWidth: '380px', padding: '30px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div className="empty-state-icon">
                  <Workflow size={24} />
                </div>
                <h3 className="empty-state-title">Workspace view collapsed</h3>
                <p className="empty-state-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Both panels are currently hidden. Click the vertical tabs on the left or right edges to restore them, or exit the workspace.
                </p>
                <button
                  onClick={() => setActiveDocId(null)}
                  style={{
                    marginTop: '8px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: 'var(--status-failed)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                  }}
                >
                  Exit Document Workspace
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Left collapsed vertical bar */}
              {!showTreePanel && (
                <div 
                  onClick={() => setShowTreePanel(true)}
                  style={{
                    width: '36px',
                    background: 'var(--bg-panel)',
                    borderRight: '1px solid var(--border-default)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px 0',
                    cursor: 'pointer',
                    gap: '20px',
                    transition: 'var(--transition)',
                    flexShrink: 0
                  }}
                  title="Expand Outline Panel"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-panel)'}
                >
                  <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    fontWeight: 500
                  }}>Outline</span>
                </div>
              )}

              {/* Left Column: Interactive Tree */}
              {showTreePanel && (
                <div className="workspace-tree-panel" style={{ width: showChatPanel ? '40%' : 'calc(100% - 36px)', borderRight: showChatPanel ? '1px solid var(--border-default)' : 'none' }}>
                  <div className="panel-header">
                    <div className="panel-title">
                      <FileText size={16} className="text-secondary" />
                      <span>Hierarchy Tree Structure</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="node-meta-p" style={{ fontSize: '11px' }}>
                        Nodes: {activeDocDetails?.tree ? activeDocDetails.tree.length : 0}
                      </div>
                      <button
                        onClick={() => setShowTreePanel(false)}
                        className="close-btn"
                        style={{
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                        title="Close/Hide Tree outline panel"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Real-time Outline Search Filter */}
                  <div style={{
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255, 255, 255, 0.015)'
                  }}>
                    <Search size={13} className="text-secondary" style={{ opacity: 0.5 }} />
                    <input
                      type="text"
                      placeholder="Filter outline by section or keywords..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit',
                        fontSize: '12px',
                        outline: 'none',
                        padding: '2px 0'
                      }}
                    />
                    {searchFilter && (
                      <button
                        onClick={() => setSearchFilter('')}
                        style={{
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          border: '1px solid var(--border-default)'
                        }}
                      >
                        clear
                      </button>
                    )}
                  </div>

                  <div className="panel-content">
                    {activeDocDetails?.tree && (
                      <InteractiveTree
                        tree={activeDocDetails.tree}
                        highlightedNodeIds={highlightedNodeIds}
                        selectedNodeId={selectedNode ? selectedNode.node_id : null}
                        onViewNodeContent={setSelectedNode}
                        filterText={searchFilter}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Right Column: Chat Console */}
              {showChatPanel && (
                <div className="workspace-chat-panel" style={{ width: showTreePanel ? '60%' : 'calc(100% - 36px)' }}>
                  <div className="panel-header">
                    <div className="panel-title">
                      <FileText size={14} className="text-secondary" />
                      <span>Document Chat</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isGenerating && (
                        <span className="logo-badge" style={{ fontSize: '10px' }}>
                          Querying...
                        </span>
                      )}
                      <button
                        onClick={() => setShowChatPanel(false)}
                        className="close-btn"
                        style={{
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                        title="Close/Hide Chat console panel"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <ChatConsole
                      messages={activeMessages}
                      onSendMessage={handleSendMessage}
                      onCitationClick={handleCitationClick}
                      isGenerating={isGenerating}
                    />
                  </div>
                </div>
              )}

              {/* Right collapsed vertical bar */}
              {!showChatPanel && (
                <div 
                  onClick={() => setShowChatPanel(true)}
                  style={{
                    width: '36px',
                    background: 'var(--bg-panel)',
                    borderLeft: '1px solid var(--border-default)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px 0',
                    cursor: 'pointer',
                    gap: '20px',
                    transition: 'var(--transition)',
                    flexShrink: 0
                  }}
                  title="Expand Chat Panel"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-panel)'}
                >
                  <MessageSquare size={14} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{
                    writingMode: 'vertical-lr',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    fontWeight: 500
                  }}>Chat Console</span>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Node detail drawer modal */}
      <NodeViewer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </>
  );
}

export default App;
