import { useState } from 'react';
import { Zap, Target, ClipboardList, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { AgentMode } from '../services/agents';

interface Props {
  value: AgentMode;
  onChange: (mode: AgentMode) => void;
  placement?: 'up' | 'down';
}

export const MODES: { id: AgentMode; label: string; icon: typeof Zap; desc: string; accent: string }[] = [
  { id: 'auto', label: 'Auto', icon: Zap, desc: 'One focused pass — plan, act, answer.', accent: 'text-blue-400' },
  { id: 'goal', label: 'Goal', icon: Target, desc: 'Work autonomously until the goal is achieved.', accent: 'text-emerald-400' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, desc: 'Produce a step-by-step plan, no execution.', accent: 'text-amber-400' },
];

export function ModePicker({ value, onChange, placement = 'down' }: Props) {
  const [open, setOpen] = useState(false);
  const active = MODES.find((m) => m.id === value) ?? MODES[0];
  const ActiveIcon = active.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        title="Agent mode"
        className={clsx('flex items-center gap-1.5 text-xs rounded-md px-2 py-1.5 border transition-colors',
          value === 'auto'
            ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
            : 'bg-zinc-800 border-zinc-600 text-zinc-100 hover:border-zinc-400')}
      >
        <ActiveIcon size={12} className={active.accent} />
        <span>{active.label}</span>
        <ChevronDown size={11} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={clsx('absolute left-0 w-64 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 py-1',
            placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1')}>
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.id} type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(m.id); setOpen(false); }}
                  className={clsx('w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5',
                    m.id === value ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}>
                  <span className="font-medium flex items-center gap-1.5"><Icon size={12} className={m.accent} /> {m.label}</span>
                  <span className="text-[10px] text-zinc-500 pl-[20px]">{m.desc}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
