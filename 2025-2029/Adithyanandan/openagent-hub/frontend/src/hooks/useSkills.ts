import { useState, useCallback, useEffect } from 'react';
import { listSkills, createSkill, updateSkill, deleteSkill, Skill } from '../services/skills';

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);

  const load = useCallback(async () => {
    try { setSkills(await listSkills()); } catch { /* ignore */ }
  }, []);

  const add = useCallback(async (payload: { name: string; description?: string; instructions: string }) => {
    const s = await createSkill(payload);
    setSkills((p) => [...p, s]);
  }, []);

  const edit = useCallback(async (id: string, payload: Partial<Skill>) => {
    const s = await updateSkill(id, payload);
    setSkills((p) => p.map((x) => (x.id === id ? s : x)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteSkill(id);
    setSkills((p) => p.filter((x) => x.id !== id));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { skills, load, add, edit, remove };
}
