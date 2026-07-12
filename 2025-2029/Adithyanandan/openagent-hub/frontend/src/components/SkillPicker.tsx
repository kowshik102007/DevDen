import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { Skill } from '../services/skills';

interface Props {
  /** '' = No skill, 'auto' = let the model pick, otherwise a skill id. */
  value: string;
  onChange: (value: string) => void;
  skills: Skill[];
  /** Which way the dropdown opens. Chat input sits at the bottom (up); the agent
   *  composer sits at the top (down). */
  placement?: 'up' | 'down';
}

export function SkillPicker({ value, onChange, skills, placement = 'up' }: Props) {
  const [open, setOpen] = useState(false);
  if (!skills || skills.length === 0) return null;

  const activeSkill = value === 'auto' || value === '' ? undefined : skills.find((s) => s.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        title="Apply a skill, or let the model pick one automatically"
        className={clsx('flex items-center gap-1 text-xs rounded-md px-1.5 py-1 transition-colors',
          value !== '' ? 'bg-purple-950/40 text-purple-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700')}
      >
        <Sparkles size={12} />
        <span className="max-w-[110px] truncate">
          {activeSkill ? activeSkill.name : value === 'auto' ? 'Skill: Auto' : 'Skill'}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={clsx('absolute left-0 w-60 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto py-1',
            placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1')}>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); onChange('auto'); setOpen(false); }}
              className={clsx('w-full text-left px-3 py-1.5 text-sm flex flex-col',
                value === 'auto' ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}>
              <span className="font-medium flex items-center gap-1.5"><Sparkles size={11} className="text-purple-400" /> Auto</span>
              <span className="text-[10px] text-zinc-500 pl-[18px]">Model picks the best skill when useful</span>
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false); }}
              className={clsx('w-full text-left px-3 py-1.5 text-sm', value === '' ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}>
              No skill
            </button>
            <div className="my-1 border-t border-zinc-700/60" />
            {skills.map((s) => (
              <button key={s.id} type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(s.id); setOpen(false); }}
                className={clsx('w-full text-left px-3 py-1.5 text-sm flex items-center gap-1.5',
                  s.id === value ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}>
                <Sparkles size={11} className="text-purple-400 flex-shrink-0" />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
