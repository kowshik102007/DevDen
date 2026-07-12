import { useState } from 'react';
import {
  Plus, Trash2, Terminal, RefreshCw, CheckCircle, AlertCircle, Circle,
  ChevronDown, ChevronRight, Sparkles, Link2, Loader2, X, Package,
} from 'lucide-react';
import clsx from 'clsx';
import { useMCP } from '../../hooks/useMCP';
import { MCPServer, CatalogEntry, ResolvedSpec, resolveSource } from '../../services/mcp';

function StatusDot({ status }: { status: MCPServer['status'] }) {
  if (status === 'healthy') return <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />;
  if (status === 'error') return <AlertCircle size={13} className="text-red-400 flex-shrink-0" />;
  return <Circle size={13} className="text-zinc-500 flex-shrink-0" />;
}

function ServerRow({ server, syncing, onSync, onToggleApprove, onDelete }: {
  server: MCPServer; syncing: boolean;
  onSync: () => void; onToggleApprove: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tools = server.tools_cache ?? [];

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 overflow-hidden">
      <div className="flex items-center gap-2 p-2.5">
        <StatusDot status={server.status} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{server.name}</p>
          <p className="text-xs text-zinc-500 truncate font-mono">{server.command} {(server.args ?? []).join(' ')}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {tools.length > 0 && (
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-0.5 text-xs px-1.5 py-1 rounded-lg text-zinc-400 hover:bg-zinc-700">
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}{tools.length} tools
            </button>
          )}
          <button onClick={onToggleApprove} title={server.auto_approve ? 'Auto-approve on' : 'Approval required'}
            className={clsx('text-xs px-2 py-1 rounded-lg font-medium transition-colors',
              server.auto_approve ? 'bg-emerald-950/50 text-emerald-300' : 'bg-zinc-700 text-zinc-400')}>
            {server.auto_approve ? 'Auto' : 'Manual'}
          </button>
          <button onClick={onSync} disabled={syncing} title="Connect & refresh tools"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button onClick={onDelete} title="Delete"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
      {open && tools.length > 0 && (
        <div className="border-t border-zinc-700 px-3 py-2 space-y-1 bg-zinc-900/40">
          {tools.map((t) => (
            <div key={t.name} className="text-xs">
              <span className="font-mono text-cyan-400">{t.name}</span>
              {t.description && <span className="text-zinc-500"> — {t.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SecretField { key: string; label: string; help?: string; default?: string }

/** Dialog that collects required secrets/config then installs. */
function InstallDialog({ title, subtitle, source, envFields, configFields, hint, installing, onInstall, onClose }: {
  title: string;
  subtitle?: string;
  source: string;
  envFields: SecretField[];
  configFields: SecretField[];
  hint?: string;
  installing: boolean;
  onInstall: (payload: { source: string; name?: string; env?: Record<string, string>; config?: Record<string, string> }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(title);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>(
    Object.fromEntries(configFields.filter((f) => f.default).map((f) => [f.key, f.default as string])),
  );
  const [error, setError] = useState<string | null>(null);

  const missing = envFields.some((f) => !env[f.key]?.trim());

  const submit = async () => {
    setError(null);
    try {
      await onInstall({
        source,
        name: name.trim() || undefined,
        env: Object.keys(env).length ? env : undefined,
        config: Object.keys(config).length ? config : undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Install failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">Install {title}</p>
            {subtitle && <p className="text-xs text-zinc-500 truncate font-mono">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"><X size={16} /></button>
        </div>

        <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-[11px] text-zinc-400 mb-1 block">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" />
          </div>

          {configFields.map((f) => (
            <div key={f.key}>
              <label className="text-[11px] text-zinc-400 mb-1 block">{f.label}</label>
              <input value={config[f.key] ?? ''} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                placeholder={f.default}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 font-mono" />
              {f.help && <p className="text-[10px] text-zinc-600 mt-1">{f.help}</p>}
            </div>
          ))}

          {envFields.map((f) => (
            <div key={f.key}>
              <label className="text-[11px] text-zinc-400 mb-1 block flex items-center gap-1">
                {f.label} <span className="text-amber-500">·secret</span>
              </label>
              <input type="password" value={env[f.key] ?? ''} onChange={(e) => setEnv({ ...env, [f.key]: e.target.value })}
                placeholder={f.key}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-600 font-mono" />
              {f.help && <p className="text-[10px] text-zinc-600 mt-1">{f.help}</p>}
            </div>
          ))}

          {hint && <p className="text-[11px] text-zinc-500 bg-zinc-800/50 rounded-lg px-2.5 py-1.5">{hint}</p>}
          {error && <p className="text-xs text-red-400 bg-red-950/30 rounded-lg px-2.5 py-1.5">{error}</p>}
        </div>

        <div className="border-t border-zinc-800 px-4 py-3">
          <button onClick={submit} disabled={installing || missing}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
            {installing ? <><Loader2 size={14} className="animate-spin" /> Installing…</> : 'Install & connect'}
          </button>
          {missing && <p className="text-[10px] text-amber-500/80 text-center mt-1.5">Fill in the required secrets to continue.</p>}
        </div>
      </div>
    </div>
  );
}

function CatalogCard({ entry, installed, onClick }: { entry: CatalogEntry; installed: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={installed}
      className={clsx('text-left rounded-xl border p-3 transition-colors group',
        installed ? 'border-emerald-900/50 bg-emerald-950/20 cursor-default'
          : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-500 hover:bg-zinc-800')}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-white truncate flex-1">{entry.name}</span>
        {installed ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle size={11} /> Installed</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-700 text-zinc-400 group-hover:bg-zinc-600">{entry.category}</span>
        )}
      </div>
      <p className="text-xs text-zinc-500 line-clamp-2">{entry.description}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] font-mono text-zinc-600 truncate flex-1">{entry.command} {entry.args.join(' ')}</span>
        {!installed && <Plus size={13} className="text-zinc-500 group-hover:text-white flex-shrink-0" />}
      </div>
    </button>
  );
}

type PendingInstall = {
  title: string;
  subtitle?: string;
  source: string;
  envFields: SecretField[];
  configFields: SecretField[];
  hint?: string;
};

export function MCPTab() {
  const { servers, catalog, syncingId, installing, edit, remove, sync, install } = useMCP();
  const [tab, setTab] = useState<'installed' | 'browse'>('installed');
  const [pending, setPending] = useState<PendingInstall | null>(null);

  // Paste-to-install state
  const [pasteValue, setPasteValue] = useState('');
  const [resolving, setResolving] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // A catalog entry counts as installed when a registered server runs the same
  // command and carries all of the entry's *fixed* args. We ignore "{{TOKEN}}"
  // placeholder args (e.g. filesystem's {{ROOT_PATH}}, git's {{REPO_PATH}}) because
  // those get filled with a concrete value at install time and would otherwise
  // never match the catalog's placeholder form.
  const isPlaceholder = (a: string) => /\{\{\w+\}\}/.test(a);
  const isInstalled = (e: CatalogEntry) => {
    const need = e.args.filter((a) => !isPlaceholder(a));
    return servers.some((s) => {
      if ((s.command || '') !== e.command) return false;
      const have = s.args ?? [];
      return need.every((a) => have.includes(a));
    });
  };

  const openCatalogInstall = (e: CatalogEntry) => {
    setPending({
      title: e.name,
      subtitle: `${e.command} ${e.args.join(' ')}`,
      source: e.id,
      envFields: e.env_required ?? [],
      configFields: e.config_required ?? [],
      hint: e.homepage ? undefined : undefined,
    });
  };

  const handlePasteResolve = async () => {
    const v = pasteValue.trim();
    if (!v) return;
    setResolving(true);
    setPasteError(null);
    try {
      const spec: ResolvedSpec = await resolveSource(v);
      setPending({
        title: spec.name || 'MCP Server',
        subtitle: `${spec.command} ${spec.args.join(' ')}`,
        source: v,
        envFields: spec.env_required ?? [],
        configFields: spec.config_required ?? [],
        hint: spec.note,
      });
    } catch (e: any) {
      setPasteError(e?.response?.data?.detail || e?.message || 'Could not resolve that source.');
    } finally {
      setResolving(false);
    }
  };

  const doInstall = async (payload: { source: string; name?: string; env?: Record<string, string>; config?: Record<string, string> }) => {
    await install(payload);
    setPasteValue('');
    setTab('installed');
  };

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
        <button onClick={() => setTab('installed')}
          className={clsx('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
            tab === 'installed' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
          <Terminal size={13} /> Installed ({servers.length})
        </button>
        <button onClick={() => setTab('browse')}
          className={clsx('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
            tab === 'browse' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
          <Sparkles size={13} /> Browse & install
        </button>
      </div>

      {tab === 'installed' ? (
        servers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-zinc-600">
            <Terminal size={28} />
            <p className="text-xs">No MCP servers yet.</p>
            <button onClick={() => setTab('browse')}
              className="mt-1 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors">
              <Sparkles size={12} /> Browse the catalog
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {servers.map((s) => (
              <ServerRow
                key={s.id}
                server={s}
                syncing={syncingId === s.id}
                onSync={() => sync(s.id)}
                onToggleApprove={() => edit(s.id, { auto_approve: !s.auto_approve })}
                onDelete={() => remove(s.id)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Paste-to-install */}
          <div className="space-y-2 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
              <Link2 size={13} /> Paste a link, package, or command
            </div>
            <p className="text-[11px] text-zinc-500">
              GitHub URL · npm package (<span className="font-mono">@scope/server-x</span>) · PyPI (<span className="font-mono">mcp-server-x</span>) · or a full command (<span className="font-mono">npx -y …</span>).
            </p>
            <div className="flex gap-2">
              <input value={pasteValue} onChange={(e) => { setPasteValue(e.target.value); setPasteError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasteResolve(); }}
                placeholder="https://github.com/owner/repo  ·  @scope/server-name  ·  mcp-server-name"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 font-mono" />
              <button onClick={handlePasteResolve} disabled={!pasteValue.trim() || resolving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                {resolving ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />} Resolve
              </button>
            </div>
            {pasteError && <p className="text-xs text-red-400">{pasteError}</p>}
          </div>

          {/* Curated catalog */}
          <div>
            <p className="text-[11px] text-zinc-500 mb-2 px-0.5">Curated servers — one click to install.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catalog.map((e) => (
                <CatalogCard key={e.id} entry={e} installed={isInstalled(e)} onClick={() => openCatalogInstall(e)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {pending && (
        <InstallDialog
          title={pending.title}
          subtitle={pending.subtitle}
          source={pending.source}
          envFields={pending.envFields}
          configFields={pending.configFields}
          hint={pending.hint}
          installing={installing}
          onInstall={doInstall}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
