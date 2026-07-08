import api from './api';

export interface Provider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  enabled: boolean;
  priority: number;
  status: 'healthy' | 'error' | 'unknown' | 'rate_limited';
  last_checked_at: string | null;
}

export interface ProviderTestResult {
  status: string;
  latency_ms: number;
  models: string[];
  error?: string;
}

export async function listProviders(): Promise<Provider[]> {
  const { data } = await api.get('/providers');
  return data;
}

export async function createProvider(data: {
  name: string;
  base_url: string;
  api_key: string;
  priority?: number;
}): Promise<Provider> {
  const { data: res } = await api.post('/providers', data);
  return res;
}

export async function updateProvider(
  id: string,
  data: Partial<{ name: string; base_url: string; api_key: string; enabled: boolean; priority: number }>
): Promise<Provider> {
  const { data: res } = await api.put(`/providers/${id}`, data);
  return res;
}

export async function deleteProvider(id: string): Promise<void> {
  await api.delete(`/providers/${id}`);
}

export async function testProvider(id: string): Promise<ProviderTestResult> {
  const { data } = await api.post(`/providers/${id}/test`);
  return data;
}

export async function fetchProviderModels(id: string): Promise<string[]> {
  const { data } = await api.get(`/providers/${id}/models`);
  return data.models;
}

// ── Provider Keys (multi-key per provider) ──────────────────────────────────

export interface ProviderKey {
  id: string;
  provider_id: string;
  label: string;
  api_key: string;
  is_active: boolean;
  rpm_limit: number | null;
  tpm_limit: number | null;
  rpm_remaining: number | null;
  tpm_remaining: number | null;
  cooldown_until: string | null;
  requests_used: number;
  tokens_used: number;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string | null;
}

export async function listProviderKeys(providerId: string): Promise<ProviderKey[]> {
  const { data } = await api.get(`/providers/${providerId}/keys`);
  return data;
}

export async function addProviderKey(providerId: string, body: { label: string; api_key: string }): Promise<ProviderKey> {
  const { data } = await api.post(`/providers/${providerId}/keys`, body);
  return data;
}

export async function updateProviderKey(providerId: string, keyId: string, body: Partial<{ label: string; api_key: string; is_active: boolean }>): Promise<ProviderKey> {
  const { data } = await api.patch(`/providers/${providerId}/keys/${keyId}`, body);
  return data;
}

export async function deleteProviderKey(providerId: string, keyId: string): Promise<void> {
  await api.delete(`/providers/${providerId}/keys/${keyId}`);
}

export interface ProviderPreset {
  name: string;
  base_url: string;
  free_mode: 'suffix' | 'contains' | 'all';
  free_patterns: string[];
  key_required: boolean;
  key_prefix: string | null;
  needs_template: boolean;
  notes: string;
}

export async function fetchProviderPresets(): Promise<ProviderPreset[]> {
  const { data } = await api.get('/providers/presets');
  return data;
}
