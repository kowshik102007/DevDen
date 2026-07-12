import api from './api';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get('/projects');
  return data;
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const { data } = await api.post('/projects', { name, description });
  return data;
}

export async function updateProject(id: string, updates: { name?: string; description?: string }): Promise<Project> {
  const { data } = await api.patch(`/projects/${id}`, updates);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}
