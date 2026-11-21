// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => {
  const asyncNoop = vi.fn(async () => undefined);
  const saving = new Proxy({}, { get: () => false });
  const busy = new Proxy({}, { get: () => false });

  const config = {
    ollamaEndpoint: 'http://localhost:11434',
    visionModel: 'llava:7b',
    language: 'zh-CN',
    promptTemplates: undefined,
    ollamaMaxConcurrency: 2,
    classifyConcurrency: 1,
    renameConcurrency: 2,
    classifyPaused: false,
    renamePaused: true,
    maxFileSize: 50 * 1024 * 1024,
    captureVideos: true,
    maxVideoSize: 200 * 1024 * 1024,
    enabledVideoTypes: ['video/mp4'],
    mediaArchiveEnabled: false,
    mediaArchiveTargetPath: '',
    mediaArchiveIntervalMinutes: 5,
    mediaArchiveConcurrency: 1,
  };

  const optionsData = {
    config,
    serviceStatus: { vfsConnected: true, ollamaAvailable: true },
    ollamaModels: [{ name: 'llava:7b' }],
    loading: false,
    saving,
    error: null,
    refreshAll: asyncNoop,
    refreshConfig: asyncNoop,
    refreshServiceStatus: asyncNoop,
    refreshOllamaModels: asyncNoop,
    refreshOllamaHealth: asyncNoop,
    refreshTags: asyncNoop,
    refreshWorkspaceConfig: asyncNoop,
    reconnectVfsService: asyncNoop,
    saveConfig: asyncNoop,
    syncMediaIndex: asyncNoop,
    clearMediaIndex: asyncNoop,
    tags: [],
    renameTag: asyncNoop,
    mergeTags: asyncNoop,
    deleteTag: asyncNoop,
    setTagPinned: asyncNoop,
    savePromptTemplate: asyncNoop,
    resetPromptTemplate: asyncNoop,
    workspaceInfo: null,
    workspaceLoading: false,
    saveWorkspacePath: asyncNoop,
    mediaArchiveStatus: {
      enabled: false,
      targetPath: '',
      intervalMinutes: 5,
      concurrency: 1,
      running: false,
      pendingCount: 0,
      failedCount: 0,
    },
    refreshMediaArchiveStatus: asyncNoop,
    saveMediaArchiveConfig: asyncNoop,
    runMediaArchive: asyncNoop,
  };

  const taskQueue = {
    status: {
      pending: 1,
      processing: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      total: 1,
      byType: {
        classify: { pending: 1, processing: 0, completed: 0, failed: 0, skipped: 0, total: 1 },
        rename: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, total: 0 },
      },
      scheduler: {
        state: 'running',
        running: true,
        processing: 0,
        byType: {
          classify: { state: 'running', processing: 0, concurrency: 1 },
          rename: { state: 'paused', processing: 0, concurrency: 2 },
        },
      },
    },
    loading: false,
    busy,
    start: asyncNoop,
    pause: asyncNoop,
    retryFailed: asyncNoop,
    clearQueue: asyncNoop,
    requeueAll: asyncNoop,
    refresh: asyncNoop,
  };

  return { config, optionsData, taskQueue };
});

vi.mock('../src/entrypoints/options/hooks/useOptionsData', () => ({
  useOptionsData: () => mocks.optionsData,
}));

vi.mock('../src/entrypoints/options/hooks/useTaskQueue', () => ({
  useTaskQueue: () => mocks.taskQueue,
}));

vi.mock('../src/entrypoints/media-browser/hooks/useTheme', () => ({
  useTheme: () => ({
    themeMode: 'auto',
    systemDark: false,
    changeTheme: vi.fn(),
    themeClass: () => '',
  }),
}));

import App from '../src/entrypoints/options/App';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('Options Ollama and task controls', () => {
  it('shows the consolidated Ollama card with chat concurrency', () => {
    window.location.hash = '#settings';
    render(<App />);

    expect(screen.getByText('Ollama 设置')).toBeTruthy();
    expect(screen.getByText('Ollama 状态')).toBeTruthy();
    expect(screen.getByText('Chat 最大并发数')).toBeTruthy();
    expect((screen.getByLabelText('Ollama Chat 最大并发数') as HTMLInputElement).value).toBe('2');
  });

  it('shows independent task cards with per-type controls', () => {
    window.location.hash = '#tasks';
    render(<App />);

    expect(screen.getByText('AI 分类')).toBeTruthy();
    expect(screen.getByText('AI 重命名')).toBeTruthy();
    expect(screen.getByLabelText('AI 分类运行开关')).toBeTruthy();
    expect(screen.getByLabelText('AI 重命名运行开关')).toBeTruthy();
    expect(screen.getByLabelText('AI 分类最大并发数')).toBeTruthy();
    expect(screen.getByLabelText('AI 重命名最大并发数')).toBeTruthy();
    expect(screen.queryByText('任务调度')).toBeNull();
  });
});
