import api from './api';

export interface ProviderStatus {
  id: string;
  name: string;
  enabled: boolean;
  status: string;
  circuit_state: 'closed' | 'open' | 'half_open';
  consecutive_failures: number;
  cooldown_until: string | null;
  last_error: string | null;
  last_error_at: string | null;
  last_checked_at: string | null;
  rpm_remaining: number | null;
  rpm_limit: number | null;
  tpm_remaining: number | null;
  tpm_limit: number | null;
  quota_reset_at: string | null;
}

export interface SystemSummary {
  total_providers: number;
  healthy_providers: number;
  total_models: number;
  requests_24h: number;
  errors_24h: number;
  success_rate_24h: number;
  pooled_rpm_remaining: number | null;
  pooled_rpm_limit: number | null;
}

export interface SystemStatus {
  providers: ProviderStatus[];
  summary: SystemSummary;
}

export interface FailoverEvent {
  id: string;
  model: string;
  provider: string | null;
  status_code: number;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const { data } = await api.get('/system/status');
  return data;
}

export async function fetchFailoverLog(limit = 50): Promise<FailoverEvent[]> {
  const { data } = await api.get(`/system/failover-log?limit=${limit}`);
  return data;
}
