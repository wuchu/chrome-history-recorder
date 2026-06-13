import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearQueue,
  checkOllamaHealth,
  ExtensionConfig,
  getConfig,
  getQueueStatus,
  listOllamaModels,
  loadServiceStatus,
  OllamaModel,
  pauseClassification,
  QueueStatus,
  reconnectVFS,
  retryFailedTasks,
  ServiceStatus,
  startClassification,
  updateConfig,
} from '../../../shared/extension-runtime';

const DEFAULT_CONFIG: ExtensionConfig = {
  ollamaEndpoint: 'http://localhost:11434',
  // visionModel 不设置默认值，从服务端接口选择返回的第一个
  language: 'zh-CN',
  filenameStyle: 'auto',
  classificationConcurrency: 1,
  classificationPaused: true,
  maxFileSize: 50 * 1024 * 1024,
  userDefinedTags: [
    { id: 'user:cat', name: 'cat', label: '🐱 猫咪', isSystem: false, sortOrder: 1 },
    { id: 'user:game', name: 'game', label: '🎮 游戏', isSystem: false, sortOrder: 2 },
    { id: 'user:screenshot', name: 'screenshot', label: '📸 截图', isSystem: false, sortOrder: 3 },
    { id: 'user:memo', name: 'memo', label: '📝 笔记', isSystem: false, sortOrder: 4 },
  ],
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

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        refreshConfig(),
        refreshQueue(),
        refreshServiceStatus(),
      ]);
      try {
        await refreshOllamaModels();
      } catch (modelsError) {
        console.warn('[Options] Failed to load Ollama models:', modelsError);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '加载配置失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [refreshConfig, refreshOllamaModels, refreshQueue, refreshServiceStatus]);

  const saveConfig = useCallback(async (updates: Partial<ExtensionConfig>, key = 'config') => {
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
  }, [config, refreshConfig, setSaving]);

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

  useEffect(() => {
    initialize();
  }, [initialize]);

  const saving = useMemo(() => ({
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
    tags: savingKeys.has('tags'),
  }), [savingKeys]);

  return {
    config,
    queueStatus,
    serviceStatus,
    ollamaModels,
    loading,
    saving,
    error,
    refreshAll: initialize,
    refreshConfig,
    refreshQueue,
    refreshServiceStatus,
    refreshOllamaModels,
    refreshOllamaHealth,
    reconnectVfsService,
    saveConfig,
    startClassification: start,
    pauseClassification: pause,
    retryFailed,
    clearQueue: clearClassificationQueue,
  };
}
