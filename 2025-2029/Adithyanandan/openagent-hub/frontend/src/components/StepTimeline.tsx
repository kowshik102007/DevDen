import { useState } from 'react';
import { Brain, Wrench, CheckCircle2, AlertCircle, ChevronRight, Terminal, Users } from 'lucide-react';
import clsx from 'clsx';
import { MarkdownContent } from './MarkdownContent';
import { LiveStep } from '../hooks/useAgents';

function ToolIcon({ tool }: { tool?: string }) {
  if (tool === 'spawn_agent') return <Users size={13} className="text-pink-400" />;
  if (tool?.startsWith('mcp__')) return <Terminal size={13} className="text-cyan-400" />;
  return <Wrench size={13} className="text-amber-400" />;
}

function prettyTool(tool?: string) {
  if (!tool) return '';
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__');
    return `${parts[2] ?? tool} · ${parts[1] ?? 'mcp'}`;
  }
  return tool;
}

function StepRow({ step }: { step: LiveStep }) {
  const [open, setOpen] = useState(false);

  if (step.type === 'thought') {
    return (
      <div className="flex gap-2.5 px-1 py-1.5">
        <Brain size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-zinc-400 italic leading-6">{step.content}</div>
      </div>
    );
  }

  if (step.type === 'tool_call') {
    return (
      <div className="flex gap-2.5 px-1 py-1">
        <ToolIcon tool={step.tool} />
        <div className="text-sm text-zinc-300 min-w-0">
          <span className="text-zinc-500">Calling </span>
          <span className="font-medium text-zinc-200">{prettyTool(step.tool)}</span>
          {step.input && Object.keys(step.input).length > 0 && (
            <code className="ml-1.5 text-xs text-zinc-500 break-all">
              {JSON.stringify(step.input)}
            </code>
          )}
        </div>
      </div>
    );
  }

  if (step.type === 'tool_result') {
    const out = step.output ?? '';
    const isErr = out.startsWith('[tool error]') || out.startsWith('[mcp error]') || out.startsWith('[blocked]');
    const long = out.length > 120;
    return (
      <div className="flex gap-2.5 px-1 py-1">
        <CheckCircle2 size={13} className={clsx('flex-shrink-0 mt-0.5', isErr ? 'text-red-400' : 'text-emerald-500/70')} />
        <div className="min-w-0 flex-1">
          <button
            onClick={() => long && setOpen((o) => !o)}
            className={clsx('text-left text-xs', isErr ? 'text-red-300' : 'text-zinc-500', long && 'hover:text-zinc-300')}
          >
            {long && <ChevronRight size={11} className={clsx('inline mr-0.5 transition-transform', open && 'rotate-90')} />}
            <span className="break-all">{open || !long ? out : `${out.slice(0, 120)}…`}</span>
          </button>
        </div>
      </div>
    );
  }

  if (step.type === 'final') {
    return (
      <div className="flex gap-2.5 px-1 py-2 mt-1 border-t border-zinc-800">
        <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <MarkdownContent>{step.content ?? ''}</MarkdownContent>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 px-1 py-1.5">
      <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-red-300">{step.content}</div>
    </div>
  );
}

export function StepTimeline({ steps, running }: { steps: LiveStep[]; running: boolean }) {
  return (
    <div className="space-y-0.5">
      {steps.map((s, i) => <StepRow key={i} step={s} />)}
      {running && (
        <div className="flex items-center gap-2 px-1 py-2 text-zinc-500 text-sm">
          <div className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          Working…
        </div>
      )}
    </div>
  );
}
