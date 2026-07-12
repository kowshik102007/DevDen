import { useState } from 'react';
import { X, Plus, Bot, Trash2, Pencil, Play, Users, Save } from 'lucide-react';
import clsx from 'clsx';
import { Agent } from '../services/agents';
import { Skill } from '../services/skills';

interface ModelOption { model: string; provider_id: string | null; provider_name?: string }

interface Props {
  agents: Agent[];
  skills: Skill[];
  models: ModelOption[];
  onClose: () => void;
  onCreate: (payload: Partial<Agent>) => Promise<void>;
  onUpdate: (id: string, payload: Partial<Agent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Use an agent for the next run and close the dialog. */
  onUse: (agent: Agent) => void;
}

type Draft = {
  id?: string;
  name: string;
  description: string;
  system_prompt: string;
  model: string | null;
  skill_id: string | null;
  allow_subagents: boolean;
};

const blank: Draft = { name: '', description: '', system_prompt: '', model: null, skill_id: null, allow_subagents: false };

export function AgentManagerDialog({ agents, skills, models, onClose, onCreate, onUpdate, onDelete, onUse }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const startNew = () => setDraft({ ...blank });
  const startEdit = (a: Agent) => setDraft({
    id: a.id,
    name: a.name,
    description: a.description ?? '',
    system_prompt: a.system_prompt ?? '',
    model: a.model,
    skill_id: a.skill_id,
    allow_subagents: a.allow_subagents,
  });

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    try {
      const payload: Partial<Agent> = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        system_prompt: draft.system_prompt.trim() || null,
        model: draft.model,
        skill_id: draft.skill_id,
        allow_subagents: draft.allow_subagents,
      };
      if (draft.id) await onUpdate(draft.id, payload);
      else await onCreate(payload);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800">
          <Bot size={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Agents</h2>
          <span className="text-xs text-zinc-600">Build and store agents your tasks can reuse.</span>
          <div className="ml-auto flex items-center gap-2">
            {!draft && (
              <button onClick={startNew}
                className="flex items-center gap-1.5 text-xs bg-white text-black rounded-lg px-2.5 py-1.5 hover:bg-zinc-200 font-medium">
                <Plus size={13} /> New agent
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {draft ? (
            <div className="space-y-3 max-w-2xl">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Name</label>
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Research Agent"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="What is this agent good at?"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">System prompt</label>
                <textarea
                  value={draft.system_prompt}
                  onChange={(e) => setDraft({ ...draft, system_prompt: e.target.value })}
                  rows={5}
                  placeholder="Persona and instructions. Leave blank for the default autonomous agent."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Default model</label>
                  <select
                    value={draft.model ?? ''}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value || null })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                  >
                    <option value="">Inherit from run</option>
                    {models.map((m) => (
                      <option key={`${m.provider_id}:${m.model}`} value={m.model}>{m.model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Default skill</label>
                  <select
                    value={draft.skill_id ?? ''}
                    onChange={(e) => setDraft({ ...draft, skill_id: e.target.value || null })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500"
                  >
                    <option value="">None</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={draft.allow_subagents}
                  onChange={(e) => setDraft({ ...draft, allow_subagents: e.target.checked })}
                  className="accent-pink-500" />
                <Users size={13} className="text-pink-400" /> Allow this agent to spawn sub-agents
              </label>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={save} disabled={!draft.name.trim() || saving}
                  className={clsx('flex items-center gap-1.5 text-sm rounded-lg px-3.5 py-2 font-medium',
                    draft.name.trim() ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed')}>
                  <Save size={13} /> {draft.id ? 'Save changes' : 'Create agent'}
                </button>
                <button onClick={() => setDraft(null)} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-2">Cancel</button>
              </div>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 text-zinc-600">
              <Bot size={36} className="mb-3" />
              <p className="text-sm">No saved agents yet.</p>
              <p className="text-xs mt-1 text-zinc-700">Create one to reuse a persona, model, and skill across tasks.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {agents.map((a) => (
                <div key={a.id} className="group bg-zinc-800/60 border border-zinc-700 rounded-xl p-3.5 flex flex-col">
                  <div className="flex items-start gap-2">
                    <Bot size={15} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-100 truncate">{a.name}</p>
                      {a.description && <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{a.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {a.model && <span className="text-[10px] bg-zinc-700/60 text-zinc-400 rounded px-1.5 py-0.5">{a.model}</span>}
                    {a.allow_subagents && <span className="text-[10px] bg-pink-950/40 text-pink-300 rounded px-1.5 py-0.5">multi-agent</span>}
                    {a.is_builtin && <span className="text-[10px] bg-zinc-700/60 text-zinc-400 rounded px-1.5 py-0.5">built-in</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-3 pt-2 border-t border-zinc-700/60">
                    <button onClick={() => onUse(a)}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-md hover:bg-zinc-700/60">
                      <Play size={11} /> Use
                    </button>
                    <button onClick={() => startEdit(a)}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-md hover:bg-zinc-700/60">
                      <Pencil size={11} /> Edit
                    </button>
                    {!a.is_builtin && (
                      <button onClick={() => { if (confirm(`Delete agent "${a.name}"?`)) onDelete(a.id); }}
                        className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 px-2 py-1 rounded-md hover:bg-red-950/30">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
