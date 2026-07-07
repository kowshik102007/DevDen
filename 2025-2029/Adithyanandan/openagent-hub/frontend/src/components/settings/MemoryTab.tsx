import { useState } from 'react';
import { Plus, Trash2, Brain, Edit2, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { useMemory } from '../../hooks/useMemory';

const SCOPE_LABEL: Record<string, string> = {
  user: 'User',
  project: 'Project',
  conversation: 'Conversation',
};

export function MemoryTab() {
  const { memories, add, edit, remove } = useMemory();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const submit = async () => {
    if (draft.trim()) await add(draft.trim(), 'user');
    setDraft('');
    setAdding(false);
  };

  const submitEdit = async (id: string) => {
    if (editDraft.trim()) await edit(id, editDraft.trim());
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Persistent facts injected into every chat and agent run. {memories.length} stored.
        </p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
        >
          <Plus size={12} /> {adding ? 'Cancel' : 'Add'}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="e.g. I prefer TypeScript and concise explanations."
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 resize-none"
          />
          <button onClick={submit} disabled={!draft.trim()}
            className="self-end px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
            Save memory
          </button>
        </div>
      )}

      {memories.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-2 py-10 text-zinc-600">
          <Brain size={28} />
          <p className="text-xs">No memories yet. Add facts the AI should always remember.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {memories.map((m) => (
            <div key={m.id} className="group flex items-start gap-2 p-2.5 rounded-xl border border-zinc-700 bg-zinc-800/50">
              <Brain size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
              {editingId === m.id ? (
                <div className="flex-1 flex items-start gap-1.5">
                  <textarea
                    autoFocus value={editDraft} onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(m.id); } if (e.key === 'Escape') setEditingId(null); }}
                    rows={2}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500 resize-none"
                  />
                  <button onClick={() => submitEdit(m.id)} className="text-emerald-400 hover:text-emerald-300 mt-1"><Check size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="text-red-400 hover:text-red-300 mt-1"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 leading-snug">{m.content}</p>
                    <span className={clsx('inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide',
                      m.source === 'agent' ? 'bg-blue-950/50 text-blue-300' : 'bg-zinc-700 text-zinc-400')}>
                      {SCOPE_LABEL[m.scope] ?? m.scope}{m.source === 'agent' ? ' · agent' : ''}
                    </span>
                  </div>
                  <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => { setEditingId(m.id); setEditDraft(m.content); }}
                      className="p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-zinc-300"><Edit2 size={12} /></button>
                    <button onClick={() => remove(m.id)}
                      className="p-1 rounded hover:bg-zinc-600 text-zinc-500 hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
