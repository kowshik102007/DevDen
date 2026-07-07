import { useState, useCallback, useEffect } from 'react';
import {
  listMCPServers, createMCPServer, updateMCPServer, deleteMCPServer, syncMCPServer,
  getCatalog, installServer, MCPServer, CatalogEntry,
} from '../services/mcp';

export function useMCP() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const load = useCallback(async () => {
    try { setServers(await listMCPServers()); } catch { /* ignore */ }
  }, []);

  const loadCatalog = useCallback(async () => {
    try { setCatalog(await getCatalog()); } catch { /* ignore */ }
  }, []);

  const add = useCallback(async (payload: { name: string; command: string; args?: string[] }) => {
    const s = await createMCPServer(payload);
    setServers((p) => [...p, s]);
    return s;
  }, []);

  const edit = useCallback(async (id: string, payload: Partial<MCPServer>) => {
    const s = await updateMCPServer(id, payload);
    setServers((p) => p.map((x) => (x.id === id ? s : x)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteMCPServer(id);
    setServers((p) => p.filter((x) => x.id !== id));
  }, []);

  const sync = useCallback(async (id: string) => {
    setSyncingId(id);
    try {
      const s = await syncMCPServer(id);
      setServers((p) => p.map((x) => (x.id === id ? s : x)));
      return s;
    } finally {
      setSyncingId(null);
    }
  }, []);

  const install = useCallback(async (payload: {
    source: string;
    name?: string;
    env?: Record<string, string>;
    config?: Record<string, string>;
    auto_approve?: boolean;
  }) => {
    setInstalling(true);
    try {
      const s = await installServer(payload);
      setServers((p) => [...p, s]);
      // Auto-sync so tools populate right away.
      try {
        const synced = await syncMCPServer(s.id);
        setServers((p) => p.map((x) => (x.id === s.id ? synced : x)));
        return synced;
      } catch {
        return s;
      }
    } finally {
      setInstalling(false);
    }
  }, []);

  useEffect(() => { load(); loadCatalog(); }, [load, loadCatalog]);

  return { servers, catalog, syncingId, installing, load, loadCatalog, add, edit, remove, sync, install };
}
