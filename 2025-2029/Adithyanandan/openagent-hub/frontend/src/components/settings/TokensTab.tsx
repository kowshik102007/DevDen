import { useState, useEffect } from 'react';
import { Plus, Trash2, KeyRound, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { ApiToken, ApiTokenCreated, listTokens, createToken, revokeToken } from '../../services/tokens';

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {label ?? (copied ? 'Copied' : 'Copy')}
    </button>
  );
}

export function TokensTab() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<ApiTokenCreated | null>(null);

  const base = `${window.location.origin}/v1`;

  const refresh = async () => {
    setLoading(true);
    try {
      setTokens(await listTokens());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await createToken(name.trim() || 'token');
      setJustCreated(created);
      setName('');
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await revokeToken(id);
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-300">
          Client tokens authenticate the OpenAI-compatible <code className="text-cyan-400">/v1</code> API.
          Point the OpenAI SDK, Codex, or any OpenAI client at the base URL below and route through your
          free-tier providers (with smart <code className="text-cyan-400">auto</code> routing + failover).
        </p>
      </div>

      {/* Base URL + snippet */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">Base URL</span>
          <CopyButton value={base} />
        </div>
        <code className="block text-xs font-mono text-emerald-300 break-all">{base}</code>
        <div className="border-t border-zinc-800 pt-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-zinc-500">curl</span>
            <CopyButton
              value={`curl ${base}/chat/completions \\\n  -H "Authorization: Bearer $OAH_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`}
            />
          </div>
          <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all">{`curl ${base}/chat/completions \\
  -H "Authorization: Bearer $OAH_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`}</pre>
        </div>
      </div>

      {/* One-time plaintext reveal */}
      {justCreated && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
            <AlertTriangle size={14} />
            Copy this token now — it won't be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-amber-100 break-all bg-black/30 rounded-lg px-2 py-1.5">
              {justCreated.token}
            </code>
            <CopyButton value={justCreated.token} />
          </div>
          <button onClick={() => setJustCreated(null)} className="text-xs text-zinc-400 hover:text-zinc-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !creating && handleCreate()}
          placeholder="Token name (e.g. my-cli)"
          className="flex-1 text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create token
        </button>
      </div>

      {/* Token list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 py-4 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No tokens yet. Create one to use the /v1 API.</p>
        ) : (
          tokens.map((t) => (
            <div
              key={t.id}
              className={clsx(
                'flex items-center gap-3 rounded-xl border p-2.5',
                t.revoked ? 'border-zinc-800 bg-zinc-900/40 opacity-60' : 'border-zinc-700 bg-zinc-800/50'
              )}
            >
              <KeyRound size={15} className="text-zinc-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{t.name}</p>
                  {t.revoked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/50 text-red-300">revoked</span>}
                </div>
                <p className="text-xs text-zinc-500 font-mono truncate">
                  {t.prefix}
                  {t.last_used_at ? ` · last used ${new Date(t.last_used_at).toLocaleDateString()}` : ' · never used'}
                </p>
              </div>
              {!t.revoked && (
                <button
                  onClick={() => handleRevoke(t.id)}
                  title="Revoke"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
