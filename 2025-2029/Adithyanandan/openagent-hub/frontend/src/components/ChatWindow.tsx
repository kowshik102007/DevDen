import { useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot } from 'lucide-react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Wrench, Terminal, CheckCircle2, Zap } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ConversationDetail } from '../services/chat';

interface ToolActivity {
  tool: string;
  input?: any;
  output?: string;
}

interface Props {
  conversation: ConversationDetail | null;
  isStreaming: boolean;
  streamingContent: string;
  streamingTools?: ToolActivity[];
  routeInfo?: { model: string; provider?: string | null; reason?: string } | null;
  thinkingLabel?: string;
  error: string | null;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
}

function prettyTool(tool: string) {
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__');
    return `${parts[2] ?? tool} · ${parts[1] ?? 'mcp'}`;
  }
  return tool;
}

function ToolActivityStrip({ tools }: { tools: ToolActivity[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="px-4 pb-1">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 space-y-1">
        {tools.map((t, i) => {
          const isMcp = t.tool.startsWith('mcp__');
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              {isMcp ? <Terminal size={12} className="text-cyan-400 flex-shrink-0" />
                     : <Wrench size={12} className="text-amber-400 flex-shrink-0" />}
              <span className="text-zinc-400">Used</span>
              <span className="font-medium text-zinc-300">{prettyTool(t.tool)}</span>
              {t.output !== undefined && <CheckCircle2 size={11} className="text-emerald-500/70 flex-shrink-0" />}
              {t.output !== undefined && (
                <span className="text-zinc-600 truncate max-w-[280px]">{t.output.replace(/\n/g, ' ').slice(0, 80)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RouteChip({ info }: { info: { model: string; provider?: string | null; reason?: string } }) {
  return (
    <div className="px-4 pb-1">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300/90">
        <Zap size={11} className="text-amber-400 flex-shrink-0" />
        <span className="font-medium">Auto → {info.model}</span>
        {info.reason && <span className="text-amber-300/60">· {info.reason}</span>}
      </div>
    </div>
  );
}

export function ChatWindow({ conversation, isStreaming, streamingContent, streamingTools = [], routeInfo, thinkingLabel = 'Thinking', error, onEditMessage, onRegenerate }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true); // true = auto-scroll to bottom

  const scrollToBottom = useCallback((instant = false) => {
    bottomRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  }, []);

  // Track whether user manually scrolled away from the bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distanceFromBottom < 80;
  }, []);

  // Scroll on new message or streaming chunks — only if pinned
  useEffect(() => {
    if (pinnedRef.current) scrollToBottom(!!streamingContent);
  }, [conversation?.messages.length, streamingContent, scrollToBottom]);

  // ResizeObserver: re-scroll when content grows (code highlighting / KaTeX reflow)
  // Only fires if we're already pinned
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToBottom(true);
    });
    // Observe the inner content div, not the scroll container itself
    const inner = container.firstElementChild;
    if (inner) observer.observe(inner);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  // When a new conversation starts / user sends a message: re-pin
  const prevMessageCount = useRef(0);
  useEffect(() => {
    const count = conversation?.messages.length ?? 0;
    if (count > prevMessageCount.current) {
      pinnedRef.current = true;
      scrollToBottom(false);
    }
    prevMessageCount.current = count;
  }, [conversation?.messages.length, scrollToBottom]);

  if (!conversation && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 select-none">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
          <Bot size={30} className="text-zinc-400" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-300 mb-1">OpenAgent Hub</h2>
        <p className="text-sm">Start a conversation below</p>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
      <div className="py-4 max-w-5xl mx-auto w-full">
        {conversation?.messages.map((msg, idx, arr) => {
          const isLastAssistant =
            msg.role === 'assistant' &&
            !isStreaming &&
            arr.slice(idx + 1).every((m) => m.role !== 'assistant');
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLastAssistant={isLastAssistant}
              onEdit={onEditMessage}
              onRegenerate={isLastAssistant ? onRegenerate : undefined}
            />
          );
        })}

        {routeInfo && <RouteChip info={routeInfo} />}
        {isStreaming && <ToolActivityStrip tools={streamingTools} />}

        {isStreaming && streamingContent && (
          <div className="px-4 py-3">
            <div className="prose prose-invert max-w-none
              prose-headings:font-bold prose-headings:text-white prose-headings:mt-7 prose-headings:mb-3
              prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
              prose-p:text-zinc-200 prose-p:leading-8 prose-p:my-4 prose-p:text-base
              prose-strong:text-white prose-strong:font-semibold
              prose-li:text-zinc-200 prose-li:leading-8 prose-li:my-1 prose-li:text-base
              prose-ul:my-4 prose-ol:my-4
              prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (!inline && match) {
                      return (
                        <div className="my-3 rounded-xl overflow-hidden border border-zinc-700">
                          <div className="bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 border-b border-zinc-700">{match[1]}</div>
                          <div className="overflow-x-auto">
                            <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8rem', background: '#111' }} {...props}>
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      );
                    }
                    return <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-400 text-xs" {...props}>{children}</code>;
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  pre({ children }: any) { return <>{children}</>; },
                }}
              >
                {streamingContent}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && streamingTools.length === 0 && (
          <div className="px-4 py-3 flex items-center gap-2">
            <span className="text-sm text-zinc-400 animate-pulse">{thinkingLabel}</span>
            <span className="flex gap-0.5 items-center">
              {[0, 160, 320].map((delay) => (
                <span
                  key={delay}
                  className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        {error && (
          <div className="mx-4 my-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
