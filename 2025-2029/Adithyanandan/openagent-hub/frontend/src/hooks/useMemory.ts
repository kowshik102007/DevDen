import { useState, useCallback, useEffect } from 'react';
import { listMemories, createMemory, updateMemory, deleteMemory, Memory } from '../services/memory';

export function useMemory() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMemories(await listMemories()); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const add = useCallback(async (content: string, scope: string = 'user') => {
    const m = await createMemory(content, scope);
    setMemories((p) => [m, ...p]);
  }, []);

  const edit = useCallback(async (id: string, content: string) => {
    const m = await updateMemory(id, content);
    setMemories((p) => p.map((x) => (x.id === id ? m : x)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteMemory(id);
    setMemories((p) => p.filter((x) => x.id !== id));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { memories, loading, load, add, edit, remove };
}
