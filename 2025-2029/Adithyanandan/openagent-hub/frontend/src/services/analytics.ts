import api from './api';

export interface AnalyticsSummary {
  period_days: number;
  total_requests: number;
  successful: number;
  errors: number;
  total_tokens: number;
  avg_latency_ms: number;
}

export interface DayStats {
  date: string;
  requests: number;
  tokens: number;
}

export interface ModelStats {
  model: string;
  requests: number;
  tokens: number;
  avg_latency_ms: number;
}

export interface ProviderStats {
  provider: string;
  requests: number;
  tokens: number;
  avg_latency_ms: number;
}

export interface RecentRequest {
  id: string;
  endpoint: string;
  model: string;
  provider: string | null;
  status: number;
  latency_ms: number;
  tokens: number;
  is_stream: boolean;
  error: string | null;
  created_at: string;
}

export interface ProviderHealth {
  id: string;
  name: string;
  status: string;
  enabled: boolean;
  last_checked_at: string | null;
}

export async function fetchSummary(days = 7): Promise<AnalyticsSummary> {
  const { data } = await api.get(`/analytics/summary?days=${days}`);
  return data;
}

export async function fetchRequestsPerDay(days = 7): Promise<DayStats[]> {
  const { data } = await api.get(`/analytics/requests-per-day?days=${days}`);
  return data;
}

export async function fetchByModel(days = 7): Promise<ModelStats[]> {
  const { data } = await api.get(`/analytics/by-model?days=${days}`);
  return data;
}

export async function fetchByProvider(days = 7): Promise<ProviderStats[]> {
  const { data } = await api.get(`/analytics/by-provider?days=${days}`);
  return data;
}

export async function fetchRecent(limit = 50): Promise<RecentRequest[]> {
  const { data } = await api.get(`/analytics/recent?limit=${limit}`);
  return data;
}

export async function fetchProviderHealth(): Promise<ProviderHealth[]> {
  const { data } = await api.get('/analytics/provider-health');
  return data;
}
