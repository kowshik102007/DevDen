import api from './api';

export interface Memory {
  id: string;
  scope: 'user' | 'project' | 'conversation';
  project_id: string | null;
  conversation_id: string | null;
  content: string;
  source: string;
  created_at: string;
}

export async function listMemories(scope?: string): Promise<Memory[]> {
  const params = scope ? { scope } : {};
  const { data } = await api.get('/memory', { params });
  return data;
}

export async function createMemory(content: string, scope: string = 'user'): Promise<Memory> {
  const { data } = await api.post('/memory', { content, scope });
  return data;
}

export async function updateMemory(id: string, content: string): Promise<Memory> {
  const { data } = await api.patch(`/memory/${id}`, { content });
  return data;
}

export async function deleteMemory(id: string): Promise<void> {
  await api.delete(`/memory/${id}`);
}
