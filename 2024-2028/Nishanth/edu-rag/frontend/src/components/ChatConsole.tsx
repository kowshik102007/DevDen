import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, ChevronDown, ChevronUp, Hash } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  thinking?: string;
  nodeList?: string[];
  isPending?: boolean;
}

interface ChatConsoleProps {
  messages: Message[];
  onSendMessage: (query: string) => void;
  onCitationClick: (sectionTitle: string) => void;
  isGenerating: boolean;
}

export const ChatConsole: React.FC<ChatConsoleProps> = ({
  messages,
  onSendMessage,
  onCitationClick,
  isGenerating,
}) => {
  const [query, setQuery] = useState('');
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat history when a new message arrives
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isGenerating) return;
    onSendMessage(query);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const parseInlineElements = (text: string) => {
    if (!text) return [];
    
    const combinedRegex = /(\([^),]+,\s*(?:Page|p\.)\s*[^)]+\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];
    let match;
    combinedRegex.lastIndex = 0;
    let keyCounter = 0;
    
    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        elements.push(<span key={`txt-${keyCounter++}`}>{text.substring(lastIndex, match.index)}</span>);
      }
      
      const [, citation, boldFull, boldText, codeFull, codeText] = match;
      
      if (citation) {
        const cleanCitation = citation.slice(1, -1);
        const commaIndex = cleanCitation.lastIndexOf(',');
        if (commaIndex !== -1) {
          const sectionTitle = cleanCitation.substring(0, commaIndex).trim();
          const pageInfo = cleanCitation.substring(commaIndex + 1).trim();
          elements.push(
            <button
              key={`cit-${keyCounter++}`}
              className="citation-pill"
              onClick={() => onCitationClick(sectionTitle)}
              title={`Jump to section: ${sectionTitle}`}
            >
              <Hash size={10} style={{ opacity: 0.6 }} />
              {sectionTitle} • {pageInfo}
            </button>
          );
        } else {
          elements.push(<span key={`cit-${keyCounter++}`}>{citation}</span>);
        }
      } else if (boldFull) {
        elements.push(<strong key={`bld-${keyCounter++}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{boldText}</strong>);
      } else if (codeFull) {
        elements.push(
          <code 
            key={`cod-${keyCounter++}`} 
            style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '11px', 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '2px 5px', 
              borderRadius: '3px', 
              border: '1px solid var(--border-default)',
              color: 'var(--accent-cyan)'
            }}
          >
            {codeText}
          </code>
        );
      }
      
      lastIndex = combinedRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      elements.push(<span key={`txt-${keyCounter++}`}>{text.substring(lastIndex)}</span>);
    }
    
    return elements;
  };

  const renderMessageContent = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    
    return (
      <div className="rich-message-content" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {lines.map((line, lineIdx) => {
          const trimmed = line.trim();
          
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = line.substring(line.indexOf(' ') + 1);
            return (
              <div 
                key={`line-${lineIdx}`} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '6px', 
                  paddingLeft: '8px',
                  lineHeight: '1.6'
                }}
              >
                <span style={{ color: 'var(--text-muted)', userSelect: 'none', marginTop: '1px' }}>•</span>
                <span style={{ flex: 1 }}>{parseInlineElements(content)}</span>
              </div>
            );
          }
          
          const numListRegex = /^(\d+)\.\s+(.*)$/;
          const numMatch = trimmed.match(numListRegex);
          if (numMatch) {
            const [_, num, content] = numMatch;
            return (
              <div 
                key={`line-${lineIdx}`} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '6px', 
                  paddingLeft: '8px',
                  lineHeight: '1.6'
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', userSelect: 'none', marginTop: '2.5px' }}>{num}.</span>
                <span style={{ flex: 1 }}>{parseInlineElements(content)}</span>
              </div>
            );
          }
          
          if (!trimmed) {
            return <div key={`line-${lineIdx}`} style={{ height: '4px' }} />;
          }
          
          return (
            <p key={`line-${lineIdx}`} style={{ margin: 0, lineHeight: '1.6' }}>
              {parseInlineElements(line)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="chat-container">
      <div className="chat-history">
        {messages.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            gap: '12px',
            padding: '40px 20px',
            textAlign: 'center'
          }}>
            <Terminal size={32} className="text-muted" style={{ opacity: 0.4 }} />
            <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.2px' }}>Interactive Workspace Query</div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '340px' }}>
              Ask a question about the document. The vectorless search traces the outline structure and retrieves cited findings.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble-container ${msg.sender}`}>
            <div className="chat-bubble">
              {msg.isPending ? (
                <div className="skeleton-loader">
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {renderMessageContent(msg.text)}
                </div>
              )}
            </div>

            {/* Render Thinking Block if available */}
            {msg.thinking && !msg.isPending && (
              <ThinkingBox thinking={msg.thinking} onCitationClick={onCitationClick} />
            )}
          </div>
        ))}
        <div ref={historyEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <div className="chat-input-container">
          <textarea
            className="chat-textarea"
            placeholder={isGenerating ? "Analyzing document contents..." : "Query document outline structure..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />
          <button 
            type="submit" 
            className="send-btn" 
            disabled={!query.trim() || isGenerating}
            title="Send query"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

// Collapsible Thinking Container
interface ThinkingBoxProps {
  thinking: string;
  onCitationClick: (sectionTitle: string) => void;
}

const ThinkingBox: React.FC<ThinkingBoxProps> = ({ thinking, onCitationClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Helper to categorize each trace sentence for high accountability
  const getSentenceCategory = (sentence: string) => {
    const lower = sentence.toLowerCase();
    
    if (lower.includes('query') || lower.includes('ask') || lower.includes('identify') || lower.includes('look for') || lower.includes('find') || lower.includes('intent')) {
      return { 
        label: 'INTENT', 
        color: '#38bdf8', 
        bg: 'rgba(56, 189, 248, 0.03)' 
      };
    }
    
    if (lower.includes('context') || lower.includes('background') || lower.includes('intro') || lower.includes('definition')) {
      return { 
        label: 'CONTEXT', 
        color: '#a78bfa', 
        bg: 'rgba(167, 139, 250, 0.03)' 
      };
    }
    
    if (lower.includes('relevant') || lower.includes('select') || lower.includes('retrieve') || lower.includes('primary') || lower.includes('main') || lower.includes('node') || lower.includes('children')) {
      return { 
        label: 'RETRIEVE', 
        color: 'var(--accent-cyan)', 
        bg: 'rgba(0, 229, 255, 0.03)' 
      };
    }
    
    return { 
      label: 'TRACE', 
      color: 'var(--text-secondary)', 
      bg: 'rgba(255, 255, 255, 0.01)' 
    };
  };

  // Parse reasoning trace text dynamically to find "Node 0007 (Section Title)" or standalone node patterns and render as structured accountability steps
  const parseThinkingTrace = (text: string) => {
    if (!text) return null;

    // Pattern to match various forms of node citations (case-insensitive, optional spaces, optional #):
    // Group 1-2: node #0007 (Section Title) or node 0007 (Section Title)
    // Group 3: node #0007 or node 0007
    // Group 4: #0008
    // Group 5: 0008 (standalone 4-digit ID)
    const nodeRefRegex = /node\s*#?\s*(\d{4})\s*\(([^)]+)\)|node\s*#?\s*(\d{4})|#(\d{4})\b|\b(\d{4})\b/gi;
    
    // Split sentences while keeping punctuation
    const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) || [text];

    return (
      <div style={{ position: 'relative', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0' }}>
        {/* Dashed timeline thread */}
        <div style={{
          position: 'absolute',
          left: '7px',
          top: '10px',
          bottom: '10px',
          width: '1px',
          borderLeft: '1px dashed rgba(255, 255, 255, 0.12)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        {sentences.map((sentence, index) => {
          const trimmed = sentence.trim();
          if (!trimmed) return null;

          const category = getSentenceCategory(trimmed);
          
          let lastIndex = 0;
          const elements: React.ReactNode[] = [];
          let match;
          let keyCounter = 0;
          nodeRefRegex.lastIndex = 0;

          while ((match = nodeRefRegex.exec(trimmed)) !== null) {
            if (match.index > lastIndex) {
              elements.push(
                <span key={`txt-${keyCounter++}`}>
                  {trimmed.substring(lastIndex, match.index)}
                </span>
              );
            }

            const [
              ,
              idWithTitle,      // Group 1
              sectionTitle,     // Group 2
              idWithoutTitle,   // Group 3
              bareIdWithHash,   // Group 4
              bareId            // Group 5
            ] = match;

            if (idWithTitle) {
              // Case 1: node #0007 (Section Title)
              elements.push(
                <button
                  key={`node-${idWithTitle}-${keyCounter++}`}
                  className="thinking-node-pill"
                  onClick={() => onCitationClick(sectionTitle.trim())}
                  title={`Highlight outline section: ${sectionTitle}`}
                >
                  <Hash size={8} style={{ opacity: 0.8 }} />
                  <span style={{ fontWeight: 600 }}>node #{idWithTitle}</span>
                  <span style={{ opacity: 0.4, fontSize: '8.5px' }}>|</span>
                  <span style={{ opacity: 0.8, fontSize: '9px', fontWeight: 400 }}>{sectionTitle}</span>
                </button>
              );
            } else if (idWithoutTitle) {
              // Case 2: node #0007
              elements.push(
                <button
                  key={`node-${idWithoutTitle}-${keyCounter++}`}
                  className="thinking-node-pill"
                  onClick={() => onCitationClick(idWithoutTitle)}
                  title={`Highlight Node ID: ${idWithoutTitle}`}
                >
                  <Hash size={8} style={{ opacity: 0.8 }} />
                  <span style={{ fontWeight: 600 }}>node #{idWithoutTitle}</span>
                </button>
              );
            } else if (bareIdWithHash) {
              // Case 3: #0007
              elements.push(
                <button
                  key={`node-${bareIdWithHash}-${keyCounter++}`}
                  className="thinking-node-pill"
                  onClick={() => onCitationClick(bareIdWithHash)}
                  title={`Highlight Node ID: ${bareIdWithHash}`}
                >
                  <span style={{ opacity: 0.7, fontSize: '8.5px' }}>#</span>
                  <span style={{ fontWeight: 600 }}>{bareIdWithHash}</span>
                </button>
              );
            } else if (bareId) {
              // Case 4: Standalone 0007
              elements.push(
                <button
                  key={`node-${bareId}-${keyCounter++}`}
                  className="thinking-node-pill"
                  onClick={() => onCitationClick(bareId)}
                  title={`Highlight Node ID: ${bareId}`}
                >
                  <span style={{ opacity: 0.7, fontSize: '8.5px' }}>#</span>
                  <span style={{ fontWeight: 600 }}>{bareId}</span>
                </button>
              );
            }

            lastIndex = nodeRefRegex.lastIndex;
          }

          if (lastIndex < trimmed.length) {
            elements.push(
              <span key={`txt-${keyCounter++}`}>
                {trimmed.substring(lastIndex)}
              </span>
            );
          }

          return (
            <div 
              key={index} 
              style={{ 
                position: 'relative',
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px',
                paddingBottom: '16px'
              }}
            >
              {/* Circular indicator dot */}
              <div style={{
                position: 'absolute',
                left: '-16px',
                top: '5px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: category.color,
                boxShadow: `0 0 8px ${category.color}`,
                border: '1.5px solid rgba(10, 10, 12, 0.95)',
                zIndex: 1
              }} />
              
              {/* Header Row: Category Badge & horizontal fade line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '8.5px', 
                  fontWeight: 600,
                  color: category.color,
                  letterSpacing: '0.75px',
                  padding: '1.5px 5px',
                  borderRadius: '3px',
                  background: category.color === 'var(--accent-cyan)' 
                    ? 'rgba(0, 229, 255, 0.04)'
                    : category.color === '#38bdf8'
                      ? 'rgba(56, 189, 248, 0.04)'
                      : category.color === '#a78bfa'
                        ? 'rgba(167, 139, 250, 0.04)'
                        : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid rgba(${category.color === 'var(--accent-cyan)' ? '0, 229, 255' : category.color === '#38bdf8' ? '56, 189, 248' : '167, 139, 250'}, 0.15)`,
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {category.label}
                </span>
                
                {/* Developer visual horizontal connector accent line */}
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%)'
                }} />
              </div>
              
              {/* Monospace telemetry content log */}
              <div style={{ 
                fontSize: '11px', 
                lineHeight: '1.6', 
                color: 'var(--text-secondary)', 
                wordBreak: 'break-word',
                paddingLeft: '2px',
                fontFamily: 'var(--font-mono)',
              }}>
                {elements}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="thinking-container">
      <div className="thinking-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="thinking-header-left">
          <Terminal size={12} style={{ opacity: 0.8 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.5px' }}>Tree Search Trace</span>
        </div>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {isOpen && (
        <div className="thinking-body">
          {parseThinkingTrace(thinking)}
        </div>
      )}
    </div>
  );
};
export type { Message };
