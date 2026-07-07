import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

function CopyButton({ text, size = 12 }: { text: string; size?: number }) {
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

/** Shared Markdown renderer with the same look as chat assistant messages. */
export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="prose prose-invert max-w-none
      prose-headings:font-bold prose-headings:text-white prose-headings:mt-5 prose-headings:mb-2
      prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
      prose-p:text-zinc-200 prose-p:leading-7 prose-p:my-3 prose-p:text-sm
      prose-strong:text-white prose-strong:font-semibold
      prose-li:text-zinc-200 prose-li:leading-7 prose-li:my-0.5 prose-li:text-sm
      prose-ul:my-3 prose-ol:my-3
      prose-blockquote:border-zinc-600 prose-blockquote:text-zinc-400
      prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
      prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
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
                      customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.78rem', background: '#111' }}
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
        {children}
      </ReactMarkdown>
    </div>
  );
}
