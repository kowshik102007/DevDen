import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Edit2, RefreshCw, FileText, Download } from 'lucide-react';
import clsx from 'clsx';
import { Message } from '../services/chat';
import { attachmentUrl } from '../services/attachments';

function CopyButton({ text, size = 13 }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-500 hover:text-zinc-300"
      title="Copy"
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

interface Props {
  message: Message;
  isLastAssistant?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
}

export function MessageBubble({ message, isLastAssistant, onEdit, onRegenerate }: Props) {
  const isUser = message.role === 'user';
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [hovered, setHovered] = useState(false);

  const submitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(message.id, trimmed);
    }
    setEditing(false);
  };

  if (isUser) {
    return (
      <div
        className="flex justify-end px-4 py-2 group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex flex-col items-end gap-1 max-w-[75%]">
          {editing ? (
            <div className="flex flex-col gap-2 w-full">
              <textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                  if (e.key === 'Escape') { setEditing(false); setEditValue(message.content); }
                }}
                rows={3}
                className="w-full bg-zinc-700 text-white rounded-xl px-3 py-2 text-sm resize-none outline-none border border-zinc-600 focus:border-zinc-400"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setEditing(false); setEditValue(message.content); }}
                  className="text-xs px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEdit}
                  className="text-xs px-3 py-1 rounded-lg bg-white text-zinc-900 font-medium hover:bg-zinc-200 transition-colors"
                >
                  Save & send
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-700 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
              {message.content}
            </div>
          )}

          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {message.attachments.map((att) => {
                const isImage = att.content_type.startsWith('image/');
                const url = attachmentUrl(att.id);
                return isImage ? (
                  <a key={att.id} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={att.filename} className="max-h-40 max-w-xs rounded-xl border border-white/10" />
                  </a>
                ) : (
                  <a
                    key={att.id}
                    href={url}
                    download={att.filename}
                    className="flex items-center gap-1.5 bg-zinc-600 hover:bg-zinc-500 rounded-lg px-2.5 py-1.5 text-xs transition-colors text-zinc-200"
                  >
                    <FileText size={12} />
                    <span className="truncate max-w-[140px]">{att.filename}</span>
                    <Download size={11} className="flex-shrink-0 opacity-60" />
                  </a>
                );
              })}
            </div>
          )}

          {!editing && hovered && onEdit && (
            <div className="flex items-center gap-0.5 px-1">
              <CopyButton text={message.content} />
              <button
                onClick={() => setEditing(true)}
                className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-500 hover:text-zinc-300"
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant message — no bubble, no icon, just text on background
  return (
    <div
      className="px-4 py-3 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="prose prose-invert max-w-none
        prose-headings:font-bold prose-headings:text-white prose-headings:mt-7 prose-headings:mb-3
        prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
        prose-p:text-zinc-200 prose-p:leading-8 prose-p:my-4 prose-p:text-base
        prose-strong:text-white prose-strong:font-semibold
        prose-em:text-zinc-300
        prose-li:text-zinc-200 prose-li:leading-8 prose-li:my-1 prose-li:text-base
        prose-ul:my-4 prose-ol:my-4
        prose-blockquote:border-zinc-600 prose-blockquote:text-zinc-400 prose-blockquote:my-4
        prose-hr:border-zinc-700 prose-hr:my-5
        prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
      ">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            code({ inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const codeStr = String(children).replace(/\n$/, '');
              if (!inline && match) {
                return (
                  <div className="my-3 rounded-xl overflow-hidden border border-zinc-700">
                    <div className="flex items-center justify-between bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 border-b border-zinc-700">
                      <span>{match[1]}</span>
                      <CopyButton text={codeStr} size={12} />
                    </div>
                    <div className="overflow-x-auto">
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8rem', background: '#111' }}
                        {...props}
                      >
                        {codeStr}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                );
              }
              return (
                <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-400 text-xs" {...props}>
                  {children}
                </code>
              );
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pre({ children }: any) { return <>{children}</>; },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {message.attachments.map((att) => {
            const isImage = att.content_type.startsWith('image/');
            const url = attachmentUrl(att.id);
            return isImage ? (
              <a key={att.id} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={att.filename} className="max-h-40 max-w-xs rounded-xl border border-white/10" />
              </a>
            ) : (
              <a
                key={att.id}
                href={url}
                download={att.filename}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg px-2.5 py-1.5 text-xs transition-colors text-zinc-300"
              >
                <FileText size={12} />
                <span className="truncate max-w-[140px]">{att.filename}</span>
                <Download size={11} className="flex-shrink-0 opacity-60" />
              </a>
            );
          })}
        </div>
      )}

      {hovered && (
        <div className={clsx('flex items-center gap-0.5 mt-1 px-0.5', isLastAssistant && onRegenerate ? '' : '')}>
          <CopyButton text={message.content} />
          {isLastAssistant && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1 rounded hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
              title="Regenerate"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
