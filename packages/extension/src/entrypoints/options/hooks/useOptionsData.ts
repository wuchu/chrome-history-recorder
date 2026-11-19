import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearQueue,
  checkOllamaHealth,
  clearIndex,
  deleteTag,
  ExtensionConfig,
  getConfig,
  getQueueStatus,
  listOllamaModels,
  listTags,
  loadServiceStatus,
  mergeTags,
  OllamaModel,
  pauseClassification,
  QueueStatus,
  reconnectVFS,
  renameTag,
  retryFailedTasks,
  ServiceStatus,
  setTagPinned,
  startClassification,
  syncBlobsToIndex,
  SyncBlobsToIndexResult,
  updateConfig,
  VFSTagRecord,
} from '../../../shared/extension-runtime';

const DEFAULT_CONFIG: ExtensionConfig = {
  ollamaEndpoint: 'http://localhost:11434',
  // visionModel 不设置默认值，从服务端接口选择返回的第一个
  language: 'zh-CN',
  filenameStyle: 'auto',
  classificationConcurrency: 1,
  classificationPaused: true,
  maxFileSize: 50 * 1024 * 1024,
};

const DEFAULT_QUEUE: QueueStatus = {
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  total: 0,
};

const DEFAULT_SERVICE_STATUS: ServiceStatus = {
  vfsConnected: false,
  ollamaAvailable: false,
};

export function useOptionsData() {
  const [config, setConfig] = useState<ExtensionConfig>(DEFAULT_CONFIG);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>(DEFAULT_QUEUE);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(DEFAULT_SERVICE_STATUS);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [tags, setTags] = useState<VFSTagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const setSaving = useCallback((key: string, saving: boolean) => {
    setSavingKeys((prev) => {
      const next = new Set(prev);
      if (saving) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const refreshConfig = useCallback(async () => {
    const nextConfig = await getConfig();
    setConfig(nextConfig);
    return nextConfig;
  }, []);

  const refreshQueue = useCallback(async () => {
    const nextQueue = await getQueueStatus();
    setQueueStatus(nextQueue);
    return nextQueue;
  }, []);

  const refreshServiceStatus = useCallback(async () => {
    const nextStatus = await loadServiceStatus();
    setServiceStatus(nextStatus);
    return nextStatus;
  }, []);

  const refreshOllamaModels = useCallback(async () => {
    const result = await listOllamaModels();
    setOllamaModels(result.models ?? []);
    return result.models ?? [];
  }, []);

  const refreshTags = useCallback(async () => {
    const nextTags = await listTags({ limit: 500 });
    setTags(nextTags);
    return nextTags;
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([refreshConfig(), refreshQueue(), refreshServiceStatus()]);
      try {
        await refreshOllamaModels();
      } catch (modelsError) {
        console.warn('[Options] Failed to load Ollama models:', modelsError);
      }
      try {
        await refreshTags();
      } catch (tagsError) {
        console.warn('[Options] Failed to load tag vocabulary:', tagsError);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '加载配置失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [refreshConfig, refreshOllamaModels, refreshQueue, refreshServiceStatus, refreshTags]);

  const saveConfig = useCallback(
    async (updates: Partial<ExtensionConfig>, key = 'config') => {
      const previousConfig = config;
      const nextConfig = { ...config, ...updates };
      setConfig(nextConfig);
      setSaving(key, true);
      setError(null);
      try {
        await updateConfig(updates);
        await refreshConfig();
      } catch (saveError) {
        setConfig(previousConfig);
        const message = saveError instanceof Error ? saveError.message : '保存配置失败';
        setError(message);
        throw saveError;
      } finally {
        setSaving(key, false);
      }
    },
    [config, refreshConfig, setSaving]
  );

  const refreshOllamaHealth = useCallback(async () => {
    setSaving('ollamaHealth', true);
    try {
      const ollamaAvailable = await checkOllamaHealth();
      setServiceStatus((prev) => ({ ...prev, ollamaAvailable }));
    } finally {
      setSaving('ollamaHealth', false);
    }
  }, [setSaving]);

  const reconnectVfsService = useCallback(async () => {
    setSaving('vfsReconnect', true);
    try {
      await reconnectVFS();
      await refreshServiceStatus();
    } finally {
      setSaving('vfsReconnect', false);
    }
  }, [refreshServiceStatus, setSaving]);

  const start = useCallback(async () => {
    setSaving('classificationState', true);
    try {
      const scheduler = await startClassification();
      setConfig((prev) => ({ ...prev, classificationPaused: false }));
      setQueueStatus((prev) => ({ ...prev, scheduler }));
      await refreshQueue();
    } finally {
      setSaving('classificationState', false);
    }
  }, [refreshQueue, setSaving]);

  const pause = useCallback(async () => {
    setSaving('classificationState', true);
    try {
      const scheduler = await pauseClassification();
      setConfig((prev) => ({ ...prev, classificationPaused: true }));
      setQueueStatus((prev) => ({ ...prev, scheduler }));
      await refreshQueue();
    } finally {
      setSaving('classificationState', false);
    }
  }, [refreshQueue, setSaving]);

  const retryFailed = useCallback(async () => {
    setSaving('retryFailed', true);
    try {
      await retryFailedTasks();
      await refreshQueue();
    } finally {
      setSaving('retryFailed', false);
    }
  }, [refreshQueue, setSaving]);

  const clearClassificationQueue = useCallback(async () => {
    setSaving('clearQueue', true);
    try {
      await clearQueue();
      await refreshQueue();
    } finally {
      setSaving('clearQueue', false);
    }
  }, [refreshQueue, setSaving]);

  const syncMediaIndex = useCallback(async (): Promise<SyncBlobsToIndexResult> => {
    setSaving('syncBlobsToIndex', true);
    try {
      return await syncBlobsToIndex();
    } finally {
      setSaving('syncBlobsToIndex', false);
    }
  }, [setSaving]);

  const clearMediaIndex = useCallback(async (): Promise<{ success: boolean }> => {
    setSaving('clearIndex', true);
    try {
      return await clearIndex();
    } finally {
      setSaving('clearIndex', false);
    }
  }, [setSaving]);

  const renameTagAction = useCallback(
    async (id: number, name: string, label?: string): Promise<VFSTagRecord> => {
      setSaving('tags', true);
      try {
        const updated = await renameTag(id, name, label);
        await refreshTags();
        return updated;
      } finally {
        setSaving('tags', false);
      }
    },
    [refreshTags, setSaving]
  );

  const mergeTagAction = useCallback(
    async (sourceId: number, targetId: number): Promise<VFSTagRecord> => {
      setSaving('tags', true);
      try {
        const merged = await mergeTags(sourceId, targetId);
        await refreshTags();
        return merged;
      } finally {
        setSaving('tags', false);
      }
    },
    [refreshTags, setSaving]
  );

  const deleteTagAction = useCallback(
    async (id: number): Promise<void> => {
      setSaving('tags', true);
      try {
        await deleteTag(id);
        await refreshTags();
      } finally {
        setSaving('tags', false);
      }
    },
    [refreshTags, setSaving]
  );

  const setTagPinnedAction = useCallback(
    async (id: number, pinned: boolean): Promise<void> => {
      setSaving('tags', true);
      try {
        await setTagPinned(id, pinned);
        await refreshTags();
      } finally {
        setSaving('tags', false);
      }
    },
    [refreshTags, setSaving]
  );

  useEffect(() => {
    initialize();
  }, [initialize]);

  const saving = useMemo(
    () => ({
      config: savingKeys.has('config'),
      ollamaEndpoint: savingKeys.has('ollamaEndpoint'),
      visionModel: savingKeys.has('visionModel'),
      filenameStyle: savingKeys.has('filenameStyle'),
      classificationState: savingKeys.has('classificationState'),
      classificationConcurrency: savingKeys.has('classificationConcurrency'),
      serviceStatus: savingKeys.has('serviceStatus'),
      ollamaHealth: savingKeys.has('ollamaHealth'),
      vfsReconnect: savingKeys.has('vfsReconnect'),
      retryFailed: savingKeys.has('retryFailed'),
      clearQueue: savingKeys.has('clearQueue'),
      syncBlobsToIndex: savingKeys.has('syncBlobsToIndex'),
      clearIndex: savingKeys.has('clearIndex'),
      tags: savingKeys.has('tags'),
    }),
    [savingKeys]
  );

  return {
    config,
    queueStatus,
    serviceStatus,
    ollamaModels,
    tags,
    loading,
    saving,
    error,
    refreshAll: initialize,
    refreshConfig,
    refreshQueue,
    refreshServiceStatus,
    refreshOllamaModels,
    refreshOllamaHealth,
    refreshTags,
    reconnectVfsService,
    saveConfig,
    startClassification: start,
    pauseClassification: pause,
    retryFailedTasks: retryFailed,
    retryFailed,
    clearQueue: clearClassificationQueue,
    syncMediaIndex,
    clearMediaIndex,
    renameTag: renameTagAction,
    mergeTags: mergeTagAction,
    deleteTag: deleteTagAction,
    setTagPinned: setTagPinnedAction,
  };
}
