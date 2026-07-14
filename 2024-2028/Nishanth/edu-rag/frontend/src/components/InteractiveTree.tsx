import React, { useState, useEffect } from 'react';
import { ChevronRight, FileText, CornerDownRight, Eye } from 'lucide-react';

export interface TreeNodeData {
  node_id: string;
  title: string;
  page_index?: number | string;
  page?: number | string;
  text?: string;
  nodes?: TreeNodeData[];
}

interface InteractiveTreeProps {
  tree: TreeNodeData[];
  highlightedNodeIds: string[];
  selectedNodeId: string | null;
  onViewNodeContent: (node: TreeNodeData) => void;
  filterText?: string;
}

// Helper to determine if a node or any of its children match the search query
const nodeMatchesFilter = (node: TreeNodeData, query: string): boolean => {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  
  if (node.title.toLowerCase().includes(lowerQuery)) return true;
  if (node.text && node.text.toLowerCase().includes(lowerQuery)) return true;
  
  if (node.nodes && node.nodes.length > 0) {
    return node.nodes.some(child => nodeMatchesFilter(child, query));
  }
  
  return false;
};

const TreeNode: React.FC<{
  node: TreeNodeData;
  depth: number;
  highlightedNodeIds: string[];
  selectedNodeId: string | null;
  onViewNodeContent: (node: TreeNodeData) => void;
  filterText: string;
}> = ({ node, depth, highlightedNodeIds, selectedNodeId, onViewNodeContent, filterText }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = node.nodes && node.nodes.length > 0;
  const isHighlighted = highlightedNodeIds.includes(node.node_id);
  const isSelected = selectedNodeId === node.node_id;

  const pageNum = node.page_index !== undefined ? node.page_index : node.page;

  // Auto-expand if a descendant node matches the filter query
  useEffect(() => {
    if (filterText && hasChildren) {
      const anyDescendantMatches = node.nodes?.some(child => nodeMatchesFilter(child, filterText));
      if (anyDescendantMatches) {
        setIsExpanded(true);
      }
    }
  }, [filterText, hasChildren, node.nodes]);

  if (filterText && !nodeMatchesFilter(node, filterText)) {
    return null;
  }

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.node-expander')) {
      setIsExpanded(!isExpanded);
    } else {
      onViewNodeContent(node);
    }
  };

  // Filter children to only render matching sub-nodes
  const filteredChildren = node.nodes 
    ? node.nodes.filter(child => nodeMatchesFilter(child, filterText))
    : [];

  return (
    <div className="tree-node" style={{ marginLeft: depth > 0 ? '4px' : '0' }}>
      <div 
        id={`tree-node-${node.node_id}`}
        className={`tree-node-row ${isHighlighted ? 'retrieved' : ''} ${isSelected ? 'highlighted' : ''}`}
        onClick={handleRowClick}
      >
        {hasChildren ? (
          <div className={`node-expander ${isExpanded ? 'expanded' : ''}`}>
            <ChevronRight size={14} />
          </div>
        ) : (
          <div style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CornerDownRight size={12} className="text-muted" style={{ opacity: 0.5 }} />
          </div>
        )}
        
        <FileText size={14} className="node-icon" />
        
        <span className="node-title" title={node.title}>
          {node.title}
        </span>

        {isHighlighted && <span className="retrieved-badge">Retrieved</span>}
        
        {pageNum !== undefined && (
          <span className="node-meta-p">p.{pageNum}</span>
        )}

        <button 
          className="node-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onViewNodeContent(node);
          }}
          title="View full section content"
        >
          <Eye size={12} />
        </button>
      </div>

      {hasChildren && isExpanded && filteredChildren.length > 0 && (
        <div className="node-children">
          {filteredChildren.map((child) => (
            <TreeNode
              key={child.node_id}
              node={child}
              depth={depth + 1}
              highlightedNodeIds={highlightedNodeIds}
              selectedNodeId={selectedNodeId}
              onViewNodeContent={onViewNodeContent}
              filterText={filterText}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const InteractiveTree: React.FC<InteractiveTreeProps> = ({
  tree,
  highlightedNodeIds,
  selectedNodeId,
  onViewNodeContent,
  filterText = '',
}) => {
  if (!tree || tree.length === 0) {
    return (
      <div style={{ 
        padding: '30px 10px', 
        textAlign: 'center', 
        color: 'var(--text-muted)',
        fontSize: '13px'
      }}>
        No tree hierarchy available for this document.
      </div>
    );
  }

  // Filter root nodes that match the query
  const matchingRootNodes = tree.filter(node => nodeMatchesFilter(node, filterText));

  if (filterText && matchingRootNodes.length === 0) {
    return (
      <div style={{ 
        padding: '30px 10px', 
        textAlign: 'center', 
        color: 'var(--text-muted)',
        fontSize: '13px',
        fontFamily: 'var(--font-mono)'
      }}>
        No outline sections match your filter.
      </div>
    );
  }

  return (
    <div className="tree-container">
      {matchingRootNodes.map((node) => (
        <TreeNode
          key={node.node_id}
          node={node}
          depth={0}
          highlightedNodeIds={highlightedNodeIds}
          selectedNodeId={selectedNodeId}
          onViewNodeContent={onViewNodeContent}
          filterText={filterText}
        />
      ))}
    </div>
  );
};
