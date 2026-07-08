import api from './api';

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  revoked: boolean;
  last_used_at: string | null;
  created_at: string | null;
}

export interface ApiTokenCreated extends ApiToken {
  token: string; // plaintext, shown only once
}

export async function listTokens(): Promise<ApiToken[]> {
  const { data } = await api.get('/tokens');
  return data;
}

export async function createToken(name: string): Promise<ApiTokenCreated> {
  const { data } = await api.post('/tokens', { name });
  return data;
}

export async function revokeToken(id: string): Promise<void> {
  await api.delete(`/tokens/${id}`);
}
