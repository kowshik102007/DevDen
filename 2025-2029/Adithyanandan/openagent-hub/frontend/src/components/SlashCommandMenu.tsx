import { forwardRef, useImperativeHandle, useState, useEffect, KeyboardEvent } from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export interface SlashCommand {
  /** Command word without the leading slash, e.g. "goal". */
  name: string;
  /** Optional argument hint shown after the name, e.g. "<task>". */
  args?: string;
  description: string;
  Icon: LucideIcon;
  accent?: string;
  /** Run the command. `rest` is any text typed after the command word. */
  run: (rest: string) => void;
  /** When true, picking from the menu keeps focus for the user to type args
   *  instead of running immediately. */
  takesArgs?: boolean;
}

export interface SlashMenuHandle {
  /** Let the menu consume nav keys (↑ ↓ Enter Tab Esc). Returns true if handled. */
  handleKeyDown: (e: KeyboardEvent) => boolean;
}

interface Props {
  commands: SlashCommand[];
  /** Full composer value; the menu shows only while it's a single "/word" token. */
  value: string;
  /** Called with the command name when one is chosen (run already invoked). */
  onPick: (cmd: SlashCommand, rest: string) => void;
  placement?: 'up' | 'down';
}

/** True while the value is a slash command still being typed (no space yet). */
export function isSlashTyping(value: string): boolean {
  return /^\/\w*$/.test(value);
}

export const SlashCommandMenu = forwardRef<SlashMenuHandle, Props>(
  ({ commands, value, onPick, placement = 'up' }, ref) => {
    const open = isSlashTyping(value);
    const query = open ? value.slice(1).toLowerCase() : '';
    const matches = commands.filter((c) => c.name.toLowerCase().startsWith(query));
    const [highlight, setHighlight] = useState(0);

    useEffect(() => { setHighlight(0); }, [query]);

    const pick = (cmd: SlashCommand) => {
      const rest = ''; // still typing the command token, so no args yet
      cmd.run(rest);
      onPick(cmd, rest);
    };

    useImperativeHandle(ref, () => ({
      handleKeyDown(e: KeyboardEvent) {
        if (!open || matches.length === 0) return false;
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % matches.length); return true; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length); return true; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[Math.min(highlight, matches.length - 1)]); return true; }
        if (e.key === 'Escape') { e.preventDefault(); return true; }
        return false;
      },
    }));

    if (!open || matches.length === 0) return null;

    return (
      <div className={clsx('absolute left-0 w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 py-1 max-h-72 overflow-y-auto',
        placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2')}>
        <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Commands</p>
        {matches.map((c, i) => {
          const Icon = c.Icon;
          return (
            <button key={c.name} type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              onMouseEnter={() => setHighlight(i)}
              className={clsx('w-full text-left px-3 py-1.5 text-sm flex items-start gap-2',
                i === highlight ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}>
              <Icon size={13} className={clsx('mt-0.5 flex-shrink-0', c.accent ?? 'text-zinc-400')} />
              <span className="min-w-0">
                <span className="font-mono text-xs">/{c.name}{c.args ? <span className="text-zinc-500"> {c.args}</span> : null}</span>
                <span className="block text-[10px] text-zinc-500 leading-snug">{c.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);
