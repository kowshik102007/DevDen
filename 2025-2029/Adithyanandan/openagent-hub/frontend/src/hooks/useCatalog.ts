import { useState, useCallback, useEffect } from 'react';
import { fetchCatalog, syncCatalog, CatalogModel } from '../services/catalog';

export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await fetchCatalog();
      setCatalog(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncCatalog();
      await loadCatalog();
    } finally {
      setSyncing(false);
    }
  }, [loadCatalog]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  return { catalog, syncing, loadCatalog, sync };
}
