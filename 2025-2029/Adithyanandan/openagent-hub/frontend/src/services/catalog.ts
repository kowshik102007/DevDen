import api from './api';

export interface CatalogModel {
  provider_id: string;
  provider_name: string;
  model_id: string;
  context_window: number | null;
  vision_support: boolean;
  reasoning_support: boolean;
  coding_score: number | null;
  speed_score: number | null;
  is_enabled: boolean;
  last_seen_at: string | null;
}

export async function fetchCatalog(): Promise<CatalogModel[]> {
  const res = await api.get('/catalog');
  return res.data;
}

export async function syncCatalog(): Promise<{ synced: number; errors: any[] }> {
  const res = await api.post('/catalog/sync');
  return res.data;
}
