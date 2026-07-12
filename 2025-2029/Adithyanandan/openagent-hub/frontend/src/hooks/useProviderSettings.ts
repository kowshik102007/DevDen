import { useState, useEffect, useCallback } from 'react';
import {
  getProviderConfig,
  updateProviderConfig,
  fetchModels,
  ProviderConfig,
} from '../services/chat';

export function useProviderSettings() {
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const c = await getProviderConfig();
      setConfig(c);
      return c;
    } catch {
      // no config yet
    }
  }, []);

  const loadModels = useCallback(async () => {
    setIsFetchingModels(true);
    try {
      const models = await fetchModels();
      setAvailableModels(models);
      return models;
    } finally {
      setIsFetchingModels(false);
    }
  }, []);

  useEffect(() => {
    loadConfig().then((c) => {
      if (c?.api_key) loadModels().catch(() => {});
    });
  }, [loadConfig, loadModels]);

  const saveConfig = useCallback(async (data: Partial<ProviderConfig>) => {
    const updated = await updateProviderConfig(data);
    setConfig(updated);
    return updated;
  }, []);

  return { config, availableModels, isFetchingModels, saveConfig, loadModels, loadConfig };
}
