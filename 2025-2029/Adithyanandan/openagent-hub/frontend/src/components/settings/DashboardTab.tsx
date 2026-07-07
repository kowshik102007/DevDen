import { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  Activity, Zap, Clock, Hash, AlertCircle, CheckCircle, Circle,
  RefreshCw, ChevronDown,
} from 'lucide-react';
import {
  AnalyticsSummary, DayStats, ModelStats, ProviderStats, RecentRequest, ProviderHealth,
  fetchSummary, fetchRequestsPerDay, fetchByModel, fetchByProvider, fetchRecent, fetchProviderHealth,
} from '../../services/analytics';

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3.5">
      <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-medium mb-1">
        {icon} {label}
      </div>
      <p className="text-xl font-semibold text-white">{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function HealthDot({ status }: { status: string }) {
  if (status === 'healthy') return <CheckCircle size={12} className="text-emerald-400" />;
  if (status === 'error') return <AlertCircle size={12} className="text-red-400" />;
  if (status === 'rate_limited') return <AlertCircle size={12} className="text-yellow-400" />;
  return <Circle size={12} className="text-zinc-500" />;
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full bg-emerald-500/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  if (status === 200) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400">200</span>;
  if (status >= 400 && status < 500) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400">{status}</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400">{status}</span>;
}

export function DashboardTab() {
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [perDay, setPerDay] = useState<DayStats[]>([]);
  const [byModel, setByModel] = useState<ModelStats[]>([]);
  const [byProvider, setByProvider] = useState<ProviderStats[]>([]);
  const [recent, setRecent] = useState<RecentRequest[]>([]);
  const [health, setHealth] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchSummary(days),
      fetchRequestsPerDay(days),
      fetchByModel(days),
      fetchByProvider(days),
      fetchRecent(30),
      fetchProviderHealth(),
    ])
      .then(([s, d, m, p, r, h]) => {
        setSummary(s); setPerDay(d); setByModel(m); setByProvider(p); setRecent(r); setHealth(h);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [days]);

  const maxDayReqs = Math.max(...perDay.map(d => d.requests), 1);
  const maxModelReqs = Math.max(...byModel.map(m => m.requests), 1);

  return (
    <div className="space-y-5">
      {/* Period selector + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={clsx('text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors',
                days === d ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
              {d}d
            </button>
          ))}
        </div>
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard label="Total Requests" value={summary.total_requests.toLocaleString()} icon={<Activity size={12} />}
            sub={`${summary.successful} ok / ${summary.errors} err`} />
          <StatCard label="Total Tokens" value={summary.total_tokens.toLocaleString()} icon={<Hash size={12} />} />
          <StatCard label="Avg Latency" value={`${summary.avg_latency_ms}ms`} icon={<Clock size={12} />} />
          <StatCard label="Success Rate"
            value={summary.total_requests > 0 ? `${Math.round((summary.successful / summary.total_requests) * 100)}%` : '—'}
            icon={<Zap size={12} />} />
        </div>
      )}

      {/* Provider health */}
      {health.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-zinc-500 mb-2">Provider Health</p>
          <div className="flex flex-wrap gap-2">
            {health.map(h => (
              <div key={h.id} className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5">
                <HealthDot status={h.status} />
                <span className="text-xs text-zinc-300">{h.name}</span>
                {!h.enabled && <span className="text-[10px] text-zinc-600">(off)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requests per day chart */}
      {perDay.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-zinc-500 mb-2">Requests / Day</p>
          <div className="flex items-end gap-1 h-20">
            {perDay.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.requests} req, ${d.tokens} tok`}>
                <div className="w-full bg-emerald-500/60 rounded-t transition-all"
                  style={{ height: `${Math.max(2, (d.requests / maxDayReqs) * 100)}%` }} />
                <span className="text-[9px] text-zinc-600 truncate w-full text-center">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By model */}
        {byModel.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-zinc-500 mb-2">By Model</p>
            <div className="space-y-1.5">
              {byModel.slice(0, 8).map(m => (
                <div key={m.model} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 truncate max-w-[60%]">{m.model || 'unknown'}</span>
                    <span className="text-zinc-500">{m.requests} req &middot; {m.avg_latency_ms}ms</span>
                  </div>
                  <MiniBar value={m.requests} max={maxModelReqs} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By provider */}
        {byProvider.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-zinc-500 mb-2">By Provider</p>
            <div className="space-y-1.5">
              {byProvider.map(p => (
                <div key={p.provider} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300">{p.provider}</span>
                    <span className="text-zinc-500">{p.requests} req &middot; {p.tokens.toLocaleString()} tok</span>
                  </div>
                  <MiniBar value={p.requests} max={byProvider[0]?.requests || 1} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent requests */}
      {recent.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-zinc-500 mb-2">Recent Requests</p>
          <div className="border border-zinc-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-zinc-800/80 text-zinc-500 text-left">
                  <th className="px-2.5 py-1.5 font-medium">Endpoint</th>
                  <th className="px-2.5 py-1.5 font-medium">Model</th>
                  <th className="px-2.5 py-1.5 font-medium">Status</th>
                  <th className="px-2.5 py-1.5 font-medium">Latency</th>
                  <th className="px-2.5 py-1.5 font-medium">Tokens</th>
                  <th className="px-2.5 py-1.5 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-2.5 py-1.5 text-zinc-300 font-mono">{r.endpoint.replace('/v1/', '')}</td>
                    <td className="px-2.5 py-1.5 text-zinc-400 truncate max-w-[120px]">{r.model || '—'}</td>
                    <td className="px-2.5 py-1.5">{r.status ? <StatusBadge status={r.status} /> : '—'}</td>
                    <td className="px-2.5 py-1.5 text-zinc-400">{r.latency_ms != null ? `${r.latency_ms}ms` : '—'}</td>
                    <td className="px-2.5 py-1.5 text-zinc-400">{r.tokens || '—'}</td>
                    <td className="px-2.5 py-1.5 text-zinc-500">
                      {r.created_at ? new Date(r.created_at).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && summary && summary.total_requests === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-600">
          <Activity size={28} />
          <p className="text-xs">No requests logged yet. Use the /v1 API to start tracking.</p>
        </div>
      )}
    </div>
  );
}
