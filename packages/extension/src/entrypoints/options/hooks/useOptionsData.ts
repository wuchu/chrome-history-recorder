import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkOllamaHealth,
  clearIndex,
  deleteTag,
  ExtensionConfig,
  DEFAULT_EXTENSION_CONFIG,
  getConfig,
  getMediaArchiveStatus,
  getWorkspaceConfig,
  listOllamaModels,
  listTags,
  loadServiceStatus,
  mergeTags,
  MediaArchiveConfigUpdate,
  MediaArchiveStatus,
  OllamaModel,
  PromptTemplates,
  reconnectVFS,
  renameTag,
  runMediaArchiveNow,
  ServiceStatus,
  setTagPinned,
  setWorkspacePath,
  syncBlobsToIndex,
  SyncBlobsToIndexResult,
  updateConfig,
  updateMediaArchiveConfig,
  VFSTagRecord,
  WorkspaceConfigInfo,
  WorkspacePathUpdateResult,
} from '../../../shared/extension-runtime';

const DEFAULT_CONFIG: ExtensionConfig = {
  ...DEFAULT_EXTENSION_CONFIG,
  enabledVideoTypes: [...DEFAULT_EXTENSION_CONFIG.enabledVideoTypes],
};

const DEFAULT_SERVICE_STATUS: ServiceStatus = {
  vfsConnected: false,
  ollamaAvailable: false,
};

export function useOptionsData() {
  const [config, setConfig] = useState<ExtensionConfig>(DEFAULT_CONFIG);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(DEFAULT_SERVICE_STATUS);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [tags, setTags] = useState<VFSTagRecord[]>([]);
  const [workspaceInfo, setWorkspaceInfo] = useState<WorkspaceConfigInfo | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [mediaArchiveStatus, setMediaArchiveStatus] = useState<MediaArchiveStatus | null>(null);
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

  const refreshWorkspaceConfig = useCallback(async () => {
    setWorkspaceLoading(true);
    try {
      const info = await getWorkspaceConfig();
      setWorkspaceInfo(info);
      return info;
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  const refreshMediaArchiveStatus = useCallback(async () => {
    const status = await getMediaArchiveStatus();
    setMediaArchiveStatus(status);
    return status;
  }, []);

  const saveMediaArchiveConfig = useCallback(
    async (update: MediaArchiveConfigUpdate): Promise<MediaArchiveStatus> => {
      setSaving('mediaArchive', true);
      setError(null);
      try {
        const status = await updateMediaArchiveConfig(update);
        setMediaArchiveStatus(status);
        return status;
      } finally {
        setSaving('mediaArchive', false);
      }
    },
    [setSaving]
  );

  const runMediaArchive = useCallback(async (): Promise<MediaArchiveStatus> => {
    setSaving('mediaArchiveRun', true);
    try {
      const status = await runMediaArchiveNow();
      setMediaArchiveStatus(status);
      return status;
    } finally {
      setSaving('mediaArchiveRun', false);
    }
  }, [setSaving]);

  const saveWorkspacePath = useCallback(
    async (nextPath: string): Promise<WorkspacePathUpdateResult> => {
      setSaving('workspace', true);
      try {
        const result = await setWorkspacePath(nextPath);
        const info = await getWorkspaceConfig();
        setWorkspaceInfo(info);
        return result;
      } finally {
        setSaving('workspace', false);
      }
    },
    [setSaving]
  );

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Only the core config + service status gate the full-page spinner.
      await Promise.all([refreshConfig(), refreshServiceStatus()]);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '加载配置失败';
      setError(message);
    } finally {
      setLoading(false);
    }

    // Non-critical data loads after the page is already interactive.
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
    try {
      await refreshWorkspaceConfig();
    } catch (workspaceError) {
      console.warn('[Options] Failed to load workspace config:', workspaceError);
      setWorkspaceInfo(null);
    }
    try {
      await refreshMediaArchiveStatus();
    } catch (archiveError) {
      console.warn('[Options] Failed to load media archive status:', archiveError);
      setMediaArchiveStatus(null);
    }
  }, [
    refreshConfig,
    refreshMediaArchiveStatus,
    refreshOllamaModels,
    refreshServiceStatus,
    refreshTags,
    refreshWorkspaceConfig,
  ]);

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

  const savePromptTemplate = useCallback(
    async (key: keyof PromptTemplates, value: string | undefined) => {
      const nextTemplates = { ...config.promptTemplates, [key]: value || undefined };
      await saveConfig({ promptTemplates: nextTemplates }, 'promptTemplates');
    },
    [config.promptTemplates, saveConfig]
  );

  const resetPromptTemplate = useCallback(
    async (key: keyof PromptTemplates) => {
      const nextTemplates = { ...config.promptTemplates, [key]: undefined };
      await saveConfig({ promptTemplates: nextTemplates }, 'promptTemplates');
    },
    [config.promptTemplates, saveConfig]
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

  // Live archive status from Background event relays.
  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const msg = message as { type?: string; data?: unknown };
      if (msg.type === 'media-archive:status' && msg.data) {
        setMediaArchiveStatus(msg.data as MediaArchiveStatus);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const saving = useMemo(
    () => ({
      config: savingKeys.has('config'),
      ollamaEndpoint: savingKeys.has('ollamaEndpoint'),
      visionModel: savingKeys.has('visionModel'),
      promptTemplates: savingKeys.has('promptTemplates'),
      classificationConcurrency: savingKeys.has('classificationConcurrency'),
      videoCapture: savingKeys.has('videoCapture'),
      serviceStatus: savingKeys.has('serviceStatus'),
      ollamaHealth: savingKeys.has('ollamaHealth'),
      vfsReconnect: savingKeys.has('vfsReconnect'),
      syncBlobsToIndex: savingKeys.has('syncBlobsToIndex'),
      clearIndex: savingKeys.has('clearIndex'),
      tags: savingKeys.has('tags'),
      workspace: savingKeys.has('workspace'),
      mediaArchive: savingKeys.has('mediaArchive'),
      mediaArchiveRun: savingKeys.has('mediaArchiveRun'),
    }),
    [savingKeys]
  );

  return {
    config,
    serviceStatus,
    ollamaModels,
    tags,
    workspaceInfo,
    workspaceLoading,
    mediaArchiveStatus,
    loading,
    saving,
    error,
    refreshAll: initialize,
    refreshConfig,
    refreshServiceStatus,
    refreshOllamaModels,
    refreshOllamaHealth,
    refreshTags,
    refreshWorkspaceConfig,
    reconnectVfsService,
    saveConfig,
    savePromptTemplate,
    resetPromptTemplate,
    saveWorkspacePath,
    refreshMediaArchiveStatus,
    saveMediaArchiveConfig,
    runMediaArchive,
    syncMediaIndex,
    clearMediaIndex,
    renameTag: renameTagAction,
    mergeTags: mergeTagAction,
    deleteTag: deleteTagAction,
    setTagPinned: setTagPinnedAction,
  };
}
