// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from '../src/entrypoints/media-browser/locales/zh.json';
import PageScanModal from '../src/entrypoints/sidepanel/components/PageScanModal';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'zh',
      resources: { zh: { translation: zh } },
      interpolation: { escapeValue: false },
    });
  }
});

const scan = {
  candidates: [
    {
      id: 'img:1',
      kind: 'img' as const,
      url: 'https://example.com/a.png',
      pageUrl: 'https://example.com/page',
      width: 800,
      height: 600,
      label: 'Hero image',
    },
    {
      id: 'background:2',
      kind: 'background' as const,
      url: 'https://example.com/b.jpg',
      pageUrl: 'https://example.com/page',
    },
  ],
  totalFound: 4,
  skippedSmall: 1,
  skippedSvg: 0,
  skippedIframes: 1,
  capped: 2,
};

function baseProps() {
  return {
    open: true,
    tabTitle: 'Example',
    scanning: false,
    scan,
    error: null,
    selected: new Set(['img:1', 'background:2']),
    saving: false,
    progress: null,
    results: [],
    onToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    onRetry: vi.fn(),
  };
}

describe('PageScanModal', () => {
  it('renders candidates and forwards selection actions', () => {
    const props = baseProps();
    render(<PageScanModal {...props} />);

    expect(screen.getByText('抓取本页媒体')).toBeTruthy();
    expect(screen.getByText('找到 4 个候选')).toBeTruthy();
    expect(screen.getByText('已选 2 / 2 个')).toBeTruthy();
    expect(screen.getByText('Hero image')).toBeTruthy();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(props.onToggle).toHaveBeenCalledWith('img:1');

    fireEvent.click(screen.getByRole('button', { name: '全选' }));
    expect(props.onSelectAll).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    expect(props.onClear).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /保存选中/ }));
    expect(props.onSave).toHaveBeenCalled();
  });

  it('renders the save result summary and failure reasons', () => {
    render(
      <PageScanModal
        {...baseProps()}
        selected={new Set()}
        results={[
          { candidateId: 'a', saved: true, duplicate: false },
          { candidateId: 'b', saved: false, duplicate: true },
          { candidateId: 'c', saved: false, duplicate: false, skipped: true },
          { candidateId: 'd', saved: false, duplicate: false, error: 'HTTP 404' },
        ]}
      />
    );

    expect(screen.getByText('已保存 1，重复 1，跳过 1，失败 1')).toBeTruthy();
    expect(screen.getByText('HTTP 404')).toBeTruthy();
  });

  it('offers retry after a scan error', () => {
    const props = baseProps();
    render(<PageScanModal {...props} scan={null} error="This page cannot be scanned" />);

    expect(screen.getByText('This page cannot be scanned')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(props.onRetry).toHaveBeenCalled();
  });
});
