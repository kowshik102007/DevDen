import React from 'react';
import { X, BookOpen } from 'lucide-react';
import type { TreeNodeData } from './InteractiveTree';

interface NodeViewerProps {
  node: TreeNodeData | null;
  onClose: () => void;
}

export const NodeViewer: React.FC<NodeViewerProps> = ({ node, onClose }) => {
  if (!node) return null;

  const pageNum = node.page_index !== undefined ? node.page_index : node.page;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title-container">
            <div className="drawer-title" title={node.title}>{node.title}</div>
            <div className="drawer-subtitle">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <BookOpen size={12} />
                Node ID: <strong>{node.node_id}</strong>
                {pageNum !== undefined && (
                  <>
                    <span style={{ margin: '0 4px' }}>•</span>
                    Page: <strong>{pageNum}</strong>
                  </>
                )}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} title="Close panel">
            <X size={16} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="drawer-text">
            {node.text ? node.text : (
              <em style={{ color: 'var(--text-muted)' }}>
                No text content available for this section. The node represents a container/header.
              </em>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
