import { useState } from 'react';
import { Wrench, Check, Minus } from 'lucide-react';
import clsx from 'clsx';
import { AgentTool } from '../services/agents';

export type ToolMode = 'off' | 'auto' | 'always';

interface Props {
  mode: ToolMode;
  onMode: (m: ToolMode) => void;
  /** Selected tool names. Empty array = all tools available. */
  selected: string[];
  onSelected: (names: string[]) => void;
  tools: AgentTool[];
  placement?: 'up' | 'down';
}

const MODES: { v: ToolMode; label: string; desc: string }[] = [
  { v: 'auto', label: 'Auto', desc: 'Use tools when helpful' },
  { v: 'always', label: 'Always', desc: 'Force a tool call first' },
  { v: 'off', label: 'Off', desc: 'Never use tools' },
];

/** Group tools by source: MCP server name or "Built-in". */
function groupTools(tools: AgentTool[]): { name: string; toolNames: string[] }[] {
  const groups: Record<string, string[]> = {};
  for (const t of tools) {
    let group = 'Built-in';
    if (t.name.startsWith('mcp__')) {
      const rest = t.name.slice(5);
      const i = rest.indexOf('__');
      group = i >= 0 ? rest.slice(0, i) : rest;
    }
    (groups[group] ??= []).push(t.name);
  }
  return Object.entries(groups).map(([name, toolNames]) => ({ name, toolNames }));
}

export function ToolPicker({ mode, onMode, selected, onSelected, tools, placement = 'up' }: Props) {
  const [open, setOpen] = useState(false);
  const groups = groupTools(tools);

  const toggleGroup = (toolNames: string[]) => {
    const allOn = toolNames.every((n) => selected.includes(n));
    if (allOn) {
      // deselect this group
      onSelected(selected.filter((n) => !toolNames.includes(n)));
    } else {
      // select all in group (union)
      const next = new Set(selected);
      toolNames.forEach((n) => next.add(n));
      onSelected([...next]);
    }
  };

  const groupState = (toolNames: string[]): 'all' | 'some' | 'none' => {
    const on = toolNames.filter((n) => selected.includes(n)).length;
    if (on === toolNames.length) return 'all';
    if (on > 0) return 'some';
    return 'none';
  };

  const selectedGroupCount = groups.filter((g) => groupState(g.toolNames) !== 'none').length;

  const label =
    mode === 'off'
      ? 'Tools'
      : `Tools: ${mode === 'auto' ? 'Auto' : 'Always'}${selectedGroupCount > 0 ? ` (${selectedGroupCount})` : ''}`;

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        title="Control whether the assistant uses tools, and which ones"
        className={clsx('flex items-center gap-1 text-xs rounded-md px-1.5 py-1 transition-colors',
          mode === 'off' ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700' : 'bg-amber-950/40 text-amber-300')}
      >
        <Wrench size={12} />
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={clsx('absolute left-0 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 py-1',
            placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1')}>
            {/* Mode */}
            {MODES.map((o) => (
              <button
                key={o.v}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onMode(o.v); }}
                className={clsx('w-full text-left px-3 py-1.5 text-sm flex flex-col',
                  mode === o.v ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-700')}
              >
                <span className="font-medium">{o.label}</span>
                <span className="text-[10px] text-zinc-500">{o.desc}</span>
              </button>
            ))}

            {/* Server-level checklist */}
            {mode !== 'off' && groups.length > 0 && (
              <>
                <div className="my-1 border-t border-zinc-700/60" />
                <div className="flex items-center justify-between px-3 pt-1 pb-1">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Limit to</span>
                  {selected.length > 0 && (
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); onSelected([]); }}
                      className="text-[10px] text-zinc-400 hover:text-zinc-200">Use all</button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {groups.map(({ name, toolNames }) => {
                    const state = groupState(toolNames);
                    return (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); toggleGroup(toolNames); }}
                        title={`${toolNames.length} tool${toolNames.length !== 1 ? 's' : ''}`}
                        className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 text-zinc-300 hover:bg-zinc-700"
                      >
                        <span className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                          state === 'all' ? 'bg-amber-500 border-amber-500 text-black'
                          : state === 'some' ? 'bg-amber-950/60 border-amber-600 text-amber-400'
                          : 'border-zinc-600')}>
                          {state === 'all' && <Check size={10} strokeWidth={3} />}
                          {state === 'some' && <Minus size={10} strokeWidth={3} />}
                        </span>
                        <span className="flex-1 truncate">{name}</span>
                        <span className="text-zinc-600 text-[10px]">{toolNames.length}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-zinc-600 px-3 pt-1 pb-0.5">
                  {selected.length === 0 ? 'No limit — all tools available.' : `${selectedGroupCount} source${selectedGroupCount !== 1 ? 's' : ''} selected.`}
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
