// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type {
  CaptureSession,
  SessionSummary as SessionSummaryType,
} from '../src/shared/extension-runtime';
import SessionBanner from '../src/entrypoints/sidepanel/components/SessionBanner';
import StartState from '../src/entrypoints/sidepanel/components/StartState';
import SessionSummary from '../src/entrypoints/sidepanel/components/SessionSummary';
import SessionMetrics from '../src/entrypoints/sidepanel/components/SessionMetrics';
import SessionFeed from '../src/entrypoints/sidepanel/components/SessionFeed';
import SessionEventLog from '../src/entrypoints/sidepanel/components/SessionEventLog';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'zh',
      resources: { zh: { translation: {} } },
      interpolation: { escapeValue: false },
    });
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function createSession(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 'session-1',
    tabId: 1,
    tabTitle: 'Example page',
    pageUrl: 'https://example.com/page',
    origin: 'https://example.com',
    startedAt: '2026-01-01T00:00:00.000Z',
    status: 'capturing',
    counters: {
      saved: 3,
      duplicate: 1,
      skipped: 2,
      failed: 1,
      bytesSaved: 2048,
      imagesSaved: 2,
      videosSaved: 1,
      aiPending: 1,
      aiProcessing: 0,
      aiCompleted: 2,
      aiFailed: 0,
      videosQueued: 1,
      videosDownloading: 0,
    },
    recentItems: [],
    events: [],
    savedHashes: [],
    aiStatuses: {},
    ...overrides,
  };
}

function createSummary(): SessionSummaryType {
  return {
    sessionId: 'session-1',
    tabId: 1,
    tabTitle: 'Example page',
    pageUrl: 'https://example.com/page',
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:01:05.000Z',
    durationMs: 65_000,
    counters: createSession().counters,
    topReasons: [{ reason: 'Image smaller than 10240 bytes', count: 2 }],
  };
}

const activeTab = {
  tabId: 1,
  windowId: 1,
  title: 'Example page',
  url: 'https://example.com/page',
  hostname: 'example.com',
  isSupported: true,
  loading: false,
};

describe('Side Panel cockpit components', () => {
  it('shows the other-tab banner and invokes its actions', () => {
    const onSwitch = vi.fn();
    const onStop = vi.fn();
    render(<SessionBanner session={createSession()} onSwitch={onSwitch} onStop={onStop} />);

    expect(screen.getByText('另一个标签页正在捕获')).toBeTruthy();
    expect(screen.getByText(/Example page/)).toBeTruthy();
    fireEvent.click(screen.getByText('切换过去'));
    fireEvent.click(screen.getByText('停止会话'));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('disables start on an unsupported page', () => {
    render(
      <StartState
        tab={{ ...activeTab, isSupported: false, url: 'chrome://settings', hostname: 'settings' }}
        onStart={() => {}}
      />
    );

    expect(screen.getByText('此页面无法捕获')).toBeTruthy();
    const button = screen.getByRole('button', { name: '开始捕获' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('starts from a supported page', () => {
    const onStart = vi.fn();
    render(<StartState tab={activeTab} onStart={onStart} />);
    fireEvent.click(screen.getByText('开始捕获'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('renders session metrics and summary', () => {
    render(
      <SessionMetrics
        counters={createSession().counters}
        startedAt="2026-01-01T00:00:00.000Z"
        status="capturing"
      />
    );
    expect(screen.getByText('2.0 KB')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders the stopped session summary and its actions', () => {
    const onRestart = vi.fn();
    const onOpenLibrary = vi.fn();
    render(
      <SessionSummary
        summary={createSummary()}
        onRestart={onRestart}
        onOpenLibrary={onOpenLibrary}
      />
    );

    expect(screen.getByText('本次会话已结束')).toBeTruthy();
    expect(screen.getByText('1:05')).toBeTruthy();
    fireEvent.click(screen.getByText('重新开始捕获'));
    fireEvent.click(screen.getByText('打开媒体库'));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
  });

  it('renders duplicates and saved items in the live feed', () => {
    const onOpenItem = vi.fn();
    render(
      <SessionFeed
        items={[
          {
            hash: 'abc',
            mimeType: 'image/png',
            size: 1024,
            capturedAt: '2026-01-01T00:00:00.000Z',
            aiStatus: 'pending',
          },
          {
            hash: 'def',
            mimeType: 'image/png',
            size: 0,
            capturedAt: '2026-01-01T00:00:01.000Z',
            duplicate: true,
          },
        ]}
        onOpenItem={onOpenItem}
      />
    );

    expect(screen.getByText('实时捕获')).toBeTruthy();
    expect(screen.getByText('已存在')).toBeTruthy();
    fireEvent.click(screen.getByTitle('abc'));
    expect(onOpenItem).toHaveBeenCalledWith('abc');
  });

  it('expands the event log, filters events, and clears', () => {
    const onClear = vi.fn();
    render(
      <SessionEventLog
        events={[
          {
            id: 'e1',
            sessionId: 'session-1',
            tabId: 1,
            pageUrl: 'https://example.com/page',
            kind: 'skipped',
            timestamp: '2026-01-01T00:00:00.000Z',
            sourceUrl: 'https://example.com/a.png',
            reason: 'Image smaller than 10240 bytes',
          },
          {
            id: 'e2',
            sessionId: 'session-1',
            tabId: 1,
            pageUrl: 'https://example.com/page',
            kind: 'failed',
            timestamp: '2026-01-01T00:00:01.000Z',
            error: 'Read failed',
          },
        ]}
        skippedCount={1}
        failedCount={1}
        onClear={onClear}
      />
    );

    expect(screen.getByText('事件日志')).toBeTruthy();
    expect(screen.getByText(/跳过 1/)).toBeTruthy();

    fireEvent.click(screen.getByText('事件日志'));
    expect(screen.getByText('Image smaller than 10240 bytes')).toBeTruthy();
    expect(screen.getAllByText('Read failed').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '失败' }));
    expect(screen.queryByText('Image smaller than 10240 bytes')).toBeNull();

    fireEvent.click(screen.getByText('清空'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
