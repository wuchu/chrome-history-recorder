import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  OneShotMediaCandidate,
  OneShotSaveResult,
  PageScanResult,
} from '../../../shared/extension-runtime';
import type { PageScanProgress } from '../hooks/usePageScan';
import { formatBytes } from '../utils';
import styles from './PageScanModal.module.css';

interface PageScanModalProps {
  open: boolean;
  tabTitle?: string;
  scanning: boolean;
  scan: PageScanResult | null;
  error: string | null;
  selected: Set<string>;
  saving: boolean;
  progress: PageScanProgress | null;
  results: OneShotSaveResult[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onSave: () => void;
  onClose: () => void;
  onRetry: () => void;
}

function candidateName(candidate: OneShotMediaCandidate): string {
  if (candidate.label) return candidate.label;
  if (candidate.url.startsWith('data:')) return 'data URL';
  if (candidate.url.startsWith('blob:')) return 'blob URL';
  try {
    const url = new URL(candidate.url);
    const path = url.pathname.length > 48 ? `${url.pathname.slice(0, 45)}…` : url.pathname;
    return `${url.hostname}${path}`;
  } catch {
    return candidate.url;
  }
}

function CandidateThumb({ candidate }: { candidate: OneShotMediaCandidate }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const isBlob = candidate.url.startsWith('blob:');
  if (isBlob || failed) {
    return (
      <span className={styles.thumbPlaceholder}>
        {isBlob ? t('oneShot.blobPreview', 'blob') : '—'}
      </span>
    );
  }
  return (
    <img
      className={styles.thumb}
      src={candidate.url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function PageScanModal({
  open,
  tabTitle,
  scanning,
  scan,
  error,
  selected,
  saving,
  progress,
  results,
  onToggle,
  onSelectAll,
  onClear,
  onSave,
  onClose,
  onRetry,
}: PageScanModalProps) {
  const { t } = useTranslation();
  if (!open) return null;

  const candidates = scan?.candidates ?? [];
  const saved = results.filter((result) => result.saved).length;
  const duplicates = results.filter((result) => result.duplicate).length;
  const skipped = results.filter((result) => result.skipped).length;
  const failed = results.filter(
    (result) => !result.saved && !result.duplicate && !result.skipped
  ).length;
  const failureReasons = [
    ...new Set(
      results
        .filter((result) => !result.saved && !result.duplicate && !result.skipped)
        .map((result) => result.error)
        .filter((reason): reason is string => Boolean(reason))
    ),
  ].slice(0, 4);

  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('oneShot.title', '抓取本页媒体')}
    >
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{t('oneShot.title', '抓取本页媒体')}</div>
          {tabTitle && <div className={styles.subtitle}>{tabTitle}</div>}
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          disabled={saving}
          aria-label={t('oneShot.close', '关闭')}
        >
          ×
        </button>
      </div>

      <div className={styles.body}>
        {scanning && <div className={styles.empty}>{t('oneShot.scanning', '正在扫描页面…')}</div>}

        {!scanning && error && <div className={styles.error}>{error}</div>}

        {!scanning && !error && scan && (
          <>
            <div className={styles.summary}>
              <span>
                {t('oneShot.found', {
                  count: scan.totalFound,
                  defaultValue: '找到 {{count}} 个候选',
                })}
              </span>
              <span>
                {t('oneShot.selected', {
                  selected: selected.size,
                  total: candidates.length,
                  defaultValue: '已选 {{selected}} / {{total}} 个',
                })}
              </span>
              {scan.skippedSmall > 0 && (
                <span>
                  {t('oneShot.skippedSmall', {
                    count: scan.skippedSmall,
                    defaultValue: '跳过过小 {{count}}',
                  })}
                </span>
              )}
              {scan.skippedSvg > 0 && (
                <span>
                  {t('oneShot.skippedSvg', {
                    count: scan.skippedSvg,
                    defaultValue: '跳过 SVG {{count}}',
                  })}
                </span>
              )}
              {scan.skippedIframes > 0 && (
                <span>
                  {t('oneShot.skippedIframes', {
                    count: scan.skippedIframes,
                    defaultValue: '跳过 iframe {{count}}',
                  })}
                </span>
              )}
              {scan.capped > 0 && (
                <span>
                  {t('oneShot.capped', {
                    count: scan.capped,
                    defaultValue: '超出上限 {{count}}',
                  })}
                </span>
              )}
            </div>

            {candidates.length === 0 ? (
              <div className={styles.empty}>{t('oneShot.empty', '没有找到可保存的媒体')}</div>
            ) : (
              <div className={styles.list}>
                {candidates.map((candidate) => (
                  <label key={candidate.id} className={styles.row}>
                    <input
                      type="checkbox"
                      checked={selected.has(candidate.id)}
                      disabled={saving}
                      onChange={() => onToggle(candidate.id)}
                    />
                    <CandidateThumb candidate={candidate} />
                    <span className={styles.meta}>
                      <span className={styles.name}>{candidateName(candidate)}</span>
                      <span className={styles.sub}>
                        {candidate.kind} ·{' '}
                        {candidate.width && candidate.height
                          ? `${candidate.width}×${candidate.height}`
                          : t('oneShot.unknownDimensions', '未知尺寸')}
                        {candidate.sizeHint ? ` · ${formatBytes(candidate.sizeHint)}` : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {results.length > 0 && (
              <div className={styles.results}>
                {t('oneShot.resultSummary', {
                  saved,
                  duplicate: duplicates,
                  skipped,
                  failed,
                  defaultValue:
                    '已保存 {{saved}}，重复 {{duplicate}}，跳过 {{skipped}}，失败 {{failed}}',
                })}
                {failureReasons.length > 0 && (
                  <ul className={styles.failureList}>
                    {failureReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.footer}>
        {saving && progress && (
          <>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
            </div>
            <div className={styles.results}>
              {t('oneShot.saving', '保存中…')} {progress.completed}/{progress.total}
            </div>
          </>
        )}

        {!scanning && !error && scan && candidates.length > 0 && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={onSelectAll}
              disabled={saving}
            >
              {t('oneShot.selectAll', '全选')}
            </button>
            <button type="button" className={styles.secondary} onClick={onClear} disabled={saving}>
              {t('oneShot.clear', '清空')}
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={onSave}
              disabled={saving || selected.size === 0}
            >
              {saving
                ? t('oneShot.savingShort', '保存中…')
                : `${t('oneShot.save', '保存选中')} (${selected.size})`}
            </button>
            <button type="button" className={styles.secondary} onClick={onClose} disabled={saving}>
              {t('oneShot.close', '关闭')}
            </button>
          </div>
        )}

        {!scanning && error && (
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onRetry}>
              {t('oneShot.retry', '重试')}
            </button>
            <button type="button" className={styles.secondary} onClick={onClose}>
              {t('oneShot.close', '关闭')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PageScanModal;
