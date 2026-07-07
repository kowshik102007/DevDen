import { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  Activity, Shield, ShieldAlert, ShieldCheck, ShieldOff,
  AlertTriangle, CheckCircle, Circle, RefreshCw, Gauge,
  Zap, Server, Clock,
} from 'lucide-react';
import {
  SystemStatus, ProviderStatus, FailoverEvent,
  fetchSystemStatus, fetchFailoverLog,
} from '../../services/system';

function CircuitBadge({ state }: { state: string }) {
  if (state === 'closed')
    return (
      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
        <ShieldCheck size={10} /> Closed
      </span>
    );
  if (state === 'open')
    return (
      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400">
        <ShieldOff size={10} /> Open
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400">
      <ShieldAlert size={10} /> Half-Open
    </span>
  );
}

function HealthDot({ status }: { status: string }) {
  if (status === 'healthy') return <CheckCircle size={12} className="text-emerald-400" />;
  if (status === 'error') return <AlertTriangle size={12} className="text-red-400" />;
  if (status === 'rate_limited') return <AlertTriangle size={12} className="text-yellow-400" />;
  return <Circle size={12} className="text-zinc-500" />;
}

function QuotaGauge({ remaining, limit, label }: { remaining: number | null; limit: number | null; label: string }) {
  if (remaining === null || limit === null || limit === 0) return null;
  const pct = Math.min(100, Math.max(0, (remaining / limit) * 100));
  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-400">{remaining}/{limit}</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ProviderCard({ p }: { p: ProviderStatus }) {
  return (
    <div className={clsx(
      'rounded-xl border p-3 space-y-2',
      p.circuit_state === 'open' ? 'border-red-800/50 bg-red-950/10' :
      p.status === 'healthy' ? 'border-zinc-700 bg-zinc-800/50' :
      'border-yellow-800/50 bg-yellow-950/10'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HealthDot status={p.status} />
          <span className="text-sm font-medium text-white">{p.name}</span>
          {!p.enabled && <span className="text-[10px] text-zinc-600">(disabled)</span>}
        </div>
        <CircuitBadge state={p.circuit_state} />
      </div>

      {p.consecutive_failures > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400">
          <AlertTriangle size={11} />
          {p.consecutive_failures} consecutive failure{p.consecutive_failures !== 1 ? 's' : ''}
          {p.cooldown_until && (
            <span className="text-zinc-500 ml-1">
              · cooldown until {new Date(p.cooldown_until).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {p.last_error && (
        <p className="text-[10px] text-zinc-500 truncate" title={p.last_error}>
          Last error: {p.last_error}
        </p>
      )}

      <div className="space-y-1">
        <QuotaGauge remaining={p.rpm_remaining} limit={p.rpm_limit} label="RPM" />
        <QuotaGauge remaining={p.tpm_remaining} limit={p.tpm_limit} label="TPM" />
      </div>

      {p.last_checked_at && (
        <p className="text-[9px] text-zinc-600">
          Checked {new Date(p.last_checked_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

export function SystemTab() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [failoverLog, setFailoverLog] = useState<FailoverEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([fetchSystemStatus(), fetchFailoverLog(30)])
      .then(([s, f]) => { setStatus(s); setFailoverLog(f); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const s = status?.summary;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Unified system health, circuit breakers, and quota pooling.</p>
        <button onClick={load} disabled={loading}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-medium mb-1">
              <Server size={12} /> Providers
            </div>
            <p className="text-xl font-semibold text-white">{s.healthy_providers}/{s.total_providers}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">healthy</p>
          </div>
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-medium mb-1">
              <Shield size={12} /> Models
            </div>
            <p className="text-xl font-semibold text-white">{s.total_models}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">available</p>
          </div>
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-medium mb-1">
              <Activity size={12} /> 24h Success
            </div>
            <p className="text-xl font-semibold text-white">{s.success_rate_24h}%</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{s.requests_24h} requests</p>
          </div>
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-medium mb-1">
              <Gauge size={12} /> Pooled RPM
            </div>
            <p className="text-xl font-semibold text-white">
              {s.pooled_rpm_remaining !== null ? s.pooled_rpm_remaining : '—'}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {s.pooled_rpm_limit !== null ? `of ${s.pooled_rpm_limit}` : 'no data yet'}
            </p>
          </div>
        </div>
      )}

      {status && status.providers.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-zinc-500 mb-2">Provider Health & Circuit Breakers</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {status.providers.filter(p => p.enabled).map(p => (
              <ProviderCard key={p.id} p={p} />
            ))}
          </div>
          {status.providers.some(p => !p.enabled) && (
            <details className="mt-2">
              <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400">
                {status.providers.filter(p => !p.enabled).length} disabled provider(s)
              </summary>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
                {status.providers.filter(p => !p.enabled).map(p => (
                  <ProviderCard key={p.id} p={p} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {failoverLog.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-zinc-500 mb-2">Recent Failover Events</p>
          <div className="border border-zinc-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-zinc-800/80 text-zinc-500 text-left">
                  <th className="px-2.5 py-1.5 font-medium">Provider</th>
                  <th className="px-2.5 py-1.5 font-medium">Model</th>
                  <th className="px-2.5 py-1.5 font-medium">Status</th>
                  <th className="px-2.5 py-1.5 font-medium">Error</th>
                  <th className="px-2.5 py-1.5 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {failoverLog.map(e => (
                  <tr key={e.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-2.5 py-1.5 text-zinc-300">{e.provider || '—'}</td>
                    <td className="px-2.5 py-1.5 text-zinc-400 truncate max-w-[120px]">{e.model || '—'}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded',
                        e.status_code === 429 ? 'bg-yellow-900/40 text-yellow-400' :
                        'bg-red-900/40 text-red-400'
                      )}>
                        {e.status_code}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-zinc-500 truncate max-w-[200px]" title={e.error || ''}>
                      {e.error || '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-zinc-500">
                      {e.created_at ? new Date(e.created_at).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && status && status.providers.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-600">
          <Shield size={28} />
          <p className="text-xs">No providers configured. Add providers in Settings to see system status.</p>
        </div>
      )}
    </div>
  );
}
