import { useState, useCallback, useEffect } from 'react';
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  fetchProviderModels,
  Provider,
  ProviderTestResult,
} from '../services/providers';

export interface ProviderModel {
  provider_id: string;
  provider_name: string;
  model: string;
}

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerModels, setProviderModels] = useState<ProviderModel[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProviders = useCallback(async () => {
    try {
      const list = await listProviders();
      setProviders(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const loadAllModels = useCallback(async (list?: Provider[]) => {
    const target = list ?? providers;
    const enabled = target.filter((p) => p.enabled);
    // Fetch providers' model lists with a small concurrency cap. Firing every
    // provider at once can trip free-tier rate limits (a burst of /models calls
    // → a 429 → a noisy 502); a cap of 3 keeps loads smooth and quiet.
    const CONCURRENCY = 3;
    const all: ProviderModel[] = [];
    for (let i = 0; i < enabled.length; i += CONCURRENCY) {
      const batch = enabled.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (p) => {
          const models = await fetchProviderModels(p.id);
          return models.map((m): ProviderModel => ({
            provider_id: p.id,
            provider_name: p.name,
            model: m,
          }));
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') all.push(...r.value);
      }
    }
    setProviderModels(all);
    return all;
  }, [providers]);

  useEffect(() => {
    loadProviders().then((list) => {
      if (list.length > 0) loadAllModels(list);
    });
  }, [loadProviders]);

  const addProvider = useCallback(async (data: Parameters<typeof createProvider>[0]) => {
    const p = await createProvider(data);
    setProviders((prev) => [...prev, p]);
    return p;
  }, []);

  const editProvider = useCallback(async (id: string, data: Parameters<typeof updateProvider>[1]) => {
    const p = await updateProvider(id, data);
    setProviders((prev) => prev.map((x) => (x.id === id ? p : x)));
    return p;
  }, []);

  const removeProvider = useCallback(async (id: string) => {
    await deleteProvider(id);
    setProviders((prev) => prev.filter((x) => x.id !== id));
    setProviderModels((prev) => prev.filter((m) => m.provider_id !== id));
  }, []);

  const runTest = useCallback(async (id: string): Promise<ProviderTestResult> => {
    const result = await testProvider(id);
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: result.status as Provider['status'] } : p
      )
    );
    if (result.status === 'healthy') {
      const newModels = result.models.map((m): ProviderModel => {
        const p = providers.find((x) => x.id === id)!;
        return { provider_id: id, provider_name: p?.name ?? '', model: m };
      });
      setProviderModels((prev) => [
        ...prev.filter((m) => m.provider_id !== id),
        ...newModels,
      ]);
    }
    return result;
  }, [providers]);

  const refreshModels = useCallback(() => loadAllModels(), [loadAllModels]);

  return {
    providers,
    providerModels,
    loading,
    loadProviders,
    addProvider,
    editProvider,
    removeProvider,
    runTest,
    refreshModels,
  };
}
