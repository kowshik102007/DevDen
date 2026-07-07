import api from './api';

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  tool_names: string[] | null;
  is_builtin: boolean;
}

export async function listSkills(): Promise<Skill[]> {
  const { data } = await api.get('/skills');
  return data;
}

export async function createSkill(payload: {
  name: string;
  description?: string;
  instructions: string;
  tool_names?: string[];
}): Promise<Skill> {
  const { data } = await api.post('/skills', payload);
  return data;
}

export async function updateSkill(id: string, payload: Partial<Skill>): Promise<Skill> {
  const { data } = await api.patch(`/skills/${id}`, payload);
  return data;
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(`/skills/${id}`);
}
