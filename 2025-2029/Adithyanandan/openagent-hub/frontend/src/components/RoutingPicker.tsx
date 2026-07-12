import { useState } from 'react';
import { Zap, Target, Shield, Scale, Check } from 'lucide-react';
import clsx from 'clsx';

export type RoutingMode = 'balanced' | 'speed' | 'quality' | 'reliability';

interface Props {
  mode: RoutingMode;
  onMode: (m: RoutingMode) => void;
  placement?: 'up' | 'down';
}

const MODES: { key: RoutingMode; label: string; desc: string; Icon: typeof Zap; accent: string }[] = [
  { key: 'balanced',    label: 'Balanced',    desc: 'Smart task-aware routing',          Icon: Scale,  accent: 'text-zinc-400' },
  { key: 'speed',       label: 'Speed',       desc: 'Fastest response time',             Icon: Zap,    accent: 'text-amber-400' },
  { key: 'quality',     label: 'Quality',     desc: 'Best knowledge & reasoning',        Icon: Target, accent: 'text-blue-400' },
  { key: 'reliability', label: 'Reliability', desc: 'Proven uptime from your history',   Icon: Shield, accent: 'text-emerald-400' },
];

export function RoutingPicker({ mode, onMode, placement = 'up' }: Props) {
  const [open, setOpen] = useState(false);
  const current = MODES.find((m) => m.key === mode) ?? MODES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-md px-1.5 py-1 hover:bg-zinc-700"
      >
        <current.Icon size={11} className={current.accent} />
        <span>{current.label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={clsx(
            'absolute left-0 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden',
            placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1',
          )}>
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Routing Mode
            </p>
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onMode(m.key); setOpen(false); }}
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2',
                  m.key === mode ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700',
                )}
              >
                <m.Icon size={13} className={m.accent + ' flex-shrink-0'} />
                <span className="flex-1">
                  {m.label}
                  <span className="block text-[10px] text-zinc-500">{m.desc}</span>
                </span>
                {m.key === mode && <Check size={13} className="text-emerald-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
