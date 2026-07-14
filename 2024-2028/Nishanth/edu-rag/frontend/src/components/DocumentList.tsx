import React from 'react';
import { FileText, Loader2, Check, AlertCircle, Trash2 } from 'lucide-react';

interface Document {
  doc_id: string;
  filename: string;
  status: string;
  uploaded_at: number;
  has_tree: boolean;
}

interface DocumentListProps {
  documents: Document[];
  activeDocId: string | null;
  onSelectDocument: (docId: string) => void;
  onDeleteDocument: (docId: string, e: React.MouseEvent) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  activeDocId,
  onSelectDocument,
  onDeleteDocument,
}) => {
  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return (
          <div className="status-badge processing" title="Indexing with PageIndex...">
            <Loader2 size={12} style={{ animation: 'spin 2s linear infinite' }} />
          </div>
        );
      case 'completed':
        return (
          <div className="status-badge completed" title="Indexing completed">
            <Check size={12} />
          </div>
        );
      case 'failed':
      default:
        return (
          <div className="status-badge failed" title="Indexing failed">
            <AlertCircle size={12} />
          </div>
        );
    }
  };

  if (documents.length === 0) {
    return (
      <div style={{
        padding: '20px 10px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
        border: '1px dashed var(--border-light)'
      }}>
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="doc-list">
      {documents.map((doc) => (
        <div
          key={doc.doc_id}
          className={`doc-card ${activeDocId === doc.doc_id ? 'active' : ''}`}
          onClick={() => onSelectDocument(doc.doc_id)}
        >
          <div className="doc-info" style={{ flex: 1, overflow: 'hidden' }}>
            <FileText className="doc-file-icon" size={18} />
            <div className="doc-details">
              <div className="doc-name" title={doc.filename}>{doc.filename}</div>
              <div className="doc-meta">
                <span>{formatTime(doc.uploaded_at)}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            {getStatusIcon(doc.status)}
            <button
              className="doc-delete-btn"
              onClick={(e) => onDeleteDocument(doc.doc_id, e)}
              title="Delete document registry"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition)'
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
