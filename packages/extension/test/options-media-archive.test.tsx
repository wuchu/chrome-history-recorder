// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MediaArchiveCard from '../src/entrypoints/options/components/MediaArchiveCard';
import type { MediaArchiveStatus } from '../src/shared/extension-runtime';

const status: MediaArchiveStatus = {
  enabled: true,
  targetPath: '/Volumes/archive',
  intervalMinutes: 5,
  concurrency: 2,
  running: false,
  pendingCount: 0,
  failedCount: 0,
};

function renderCard(
  overrides: Partial<MediaArchiveStatus> = {},
  summary?: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }
) {
  const callbacks = {
    onRefresh: vi.fn(),
    onToggle: vi.fn(),
    onSave: vi.fn(),
    onRun: vi.fn(),
  };
  render(
    <MediaArchiveCard
      status={{ ...status, ...overrides }}
      summary={summary}
      savingSave={false}
      savingRun={false}
      {...callbacks}
    />
  );
  return callbacks;
}

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
});

afterEach(cleanup);

describe('MediaArchiveCard', () => {
  it('shows the saved target and interval', () => {
    renderCard();

    expect(screen.getByText('媒体归档')).toBeTruthy();
    expect((screen.getByLabelText('归档目标目录') as HTMLInputElement).value).toBe(
      '/Volumes/archive'
    );
    expect((screen.getByRole('switch') as HTMLButtonElement).getAttribute('aria-checked')).toBe(
      'true'
    );
  });

  it('saves the edited target and interval', () => {
    const { onSave } = renderCard();
    const input = screen.getByLabelText('归档目标目录');

    fireEvent.change(input, { target: { value: '/Volumes/new-archive' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    expect(onSave).toHaveBeenCalledWith('/Volumes/new-archive', 5, 2);
  });

  it('saves the edited concurrency', () => {
    const { onSave } = renderCard();
    const input = screen.getByLabelText('归档并发数');

    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    expect(onSave).toHaveBeenCalledWith('/Volumes/archive', 5, 4);
  });

  it('toggles archiving off with the current draft', () => {
    const { onToggle } = renderCard();

    fireEvent.click(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalledWith(false, '/Volumes/archive', 5, 2);
  });

  it('disables the manual action while running', () => {
    renderCard({ running: true });

    expect(screen.getByText('正在归档…')).toBeTruthy();
    expect(screen.getByRole('button', { name: '立即归档' }).hasAttribute('disabled')).toBe(true);
  });

  it('disables the manual action when archiving is off', () => {
    renderCard({ enabled: false });

    expect(screen.getByRole('button', { name: '立即归档' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows overall archive progress', () => {
    renderCard(
      { pendingCount: 2 },
      { pending: 2, processing: 1, completed: 7, failed: 0, total: 10 }
    );

    expect(screen.getByText('已完成 7 / 10 · 处理中 1 · 待处理 2')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('70');
  });

  it('renders pending/failed task counts and the last error', () => {
    renderCard({
      pendingCount: 3,
      failedCount: 2,
      lastError: '目标目录不存在',
      lastRunAt: undefined,
    });

    expect(screen.getByText('待处理任务：3')).toBeTruthy();
    expect(screen.getByText('失败任务：2')).toBeTruthy();
    expect(screen.getByText('最后错误：目标目录不存在')).toBeTruthy();
  });

  it('shows a disconnected state', () => {
    render(
      <MediaArchiveCard
        status={null}
        savingSave={false}
        savingRun={false}
        onRefresh={vi.fn()}
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onRun={vi.fn()}
      />
    );

    expect(screen.getByText('未连接后端')).toBeTruthy();
  });
});
