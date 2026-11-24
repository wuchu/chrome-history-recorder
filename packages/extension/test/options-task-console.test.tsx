// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaskConsole from '../src/entrypoints/options/components/TaskConsole';
import type { TaskActionKey } from '../src/entrypoints/options/hooks/useTaskQueue';
import type { QueueStatus } from '../src/shared/extension-runtime';

const busy = Object.fromEntries(
  (['classify', 'rename'] as const).flatMap((taskType) =>
    (['start', 'pause', 'retry', 'clear', 'rescan'] as const).map((action) => [
      `${taskType}:${action}`,
      false,
    ])
  )
) as Record<TaskActionKey, boolean>;

const status: QueueStatus = {
  pending: 2,
  processing: 0,
  completed: 0,
  failed: 1,
  skipped: 0,
  total: 3,
  byType: {
    classify: { pending: 1, processing: 0, completed: 0, failed: 1, skipped: 0, total: 2 },
    rename: { pending: 1, processing: 0, completed: 0, failed: 0, skipped: 0, total: 1 },
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
};

function renderConsole() {
  const callbacks = {
    onStart: vi.fn(async () => undefined),
    onPause: vi.fn(async () => undefined),
    onRetryFailed: vi.fn(async () => undefined),
    onClearQueue: vi.fn(async () => undefined),
    onRescan: vi.fn(async () => undefined),
    onConcurrencyChange: vi.fn(),
    onTemplateChange: vi.fn(),
    onTemplateSave: vi.fn(),
    onTemplateReset: vi.fn(),
  };

  render(
    <TaskConsole
      status={status}
      busy={busy}
      concurrency={{ classify: 1, rename: 2 }}
      templateDrafts={{ classify: 'classify prompt', rename: 'rename prompt' }}
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
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

describe('TaskConsole per-task controls', () => {
  it('shows independent run state and concurrency for each AI type', () => {
    renderConsole();

    const classifySwitch = screen.getByLabelText('AI 分类运行开关');
    const renameSwitch = screen.getByLabelText('AI 重命名运行开关');

    expect(classifySwitch.getAttribute('aria-checked')).toBe('true');
    expect(renameSwitch.getAttribute('aria-checked')).toBe('false');
    expect((screen.getByLabelText('AI 分类最大并发数') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('AI 重命名最大并发数') as HTMLInputElement).value).toBe('2');
    expect(screen.queryByText('任务调度')).toBeNull();
  });

  it('starts and pauses each type independently', () => {
    const callbacks = renderConsole();

    fireEvent.click(screen.getByLabelText('AI 分类运行开关'));
    expect(callbacks.onPause).toHaveBeenCalledWith('classify');

    fireEvent.click(screen.getByLabelText('AI 重命名运行开关'));
    expect(callbacks.onStart).toHaveBeenCalledWith('rename');
  });

  it('updates concurrency and maintenance actions per type', async () => {
    const callbacks = renderConsole();

    fireEvent.change(screen.getByLabelText('AI 分类最大并发数'), { target: { value: '3' } });
    expect(callbacks.onConcurrencyChange).toHaveBeenCalledWith('classify', 3);

    fireEvent.click(screen.getAllByRole('button', { name: /重试失败任务/ })[0]);
    expect(callbacks.onRetryFailed).toHaveBeenCalledWith('classify');

    expect(screen.queryByPlaceholderText('{{vocabulary}}')).toBeNull();
    for (const disclosure of screen.getAllByText('高级：提示词模板')) {
      fireEvent.click(disclosure);
    }
    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(2);
    });
  });
});
