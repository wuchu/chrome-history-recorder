import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionEvent } from '../../../shared/extension-runtime';
import {
  describeEvent,
  EVENT_ICONS,
  EVENT_LABELS,
  formatTime,
  matchesEventFilter,
  type EventFilter,
} from '../utils';
import styles from '../cockpit.module.css';

interface SessionEventLogProps {
  events: SessionEvent[];
  skippedCount: number;
  failedCount: number;
  onClear: () => void;
  busy?: boolean;
}

const FILTERS: Array<{ id: EventFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'saved', label: '保存' },
  { id: 'duplicate', label: '重复' },
  { id: 'skipped', label: '跳过' },
  { id: 'failed', label: '失败' },
  { id: 'video', label: '视频' },
  { id: 'ai', label: 'AI' },
];

export function SessionEventLog({
  events,
  skippedCount,
  failedCount,
  onClear,
  busy,
}: SessionEventLogProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [paused, setPaused] = useState(false);
  const [displayEvents, setDisplayEvents] = useState(events);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (paused) return;
    setDisplayEvents(events);
  }, [events, paused]);

  const newCount = useMemo(() => {
    if (!paused) return 0;
    const visibleIds = new Set(displayEvents.map((event) => event.id));
    return events.filter((event) => !visibleIds.has(event.id)).length;
  }, [displayEvents, events, paused]);

  const filtered = useMemo(
    () => displayEvents.filter((event) => matchesEventFilter(event, filter)),
    [displayEvents, filter]
  );

  const handlePause = () => {
    if (paused) {
      setDisplayEvents(events);
      setPaused(false);
    } else {
      setPaused(true);
    }
  };

  const handleCopy = async (event: SessionEvent) => {
    const text = event.sourceUrl || event.pageUrl;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(event.id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <section className={styles.eventLog}>
      <button
        type="button"
        className={styles.eventSummary}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className={styles.eventSummaryLeft}>
          <span className={styles.sectionTitle}>{t('cockpit.log.title', '事件日志')}</span>
          <span className={styles.eventSummaryStats}>
            {t('cockpit.log.summary', {
              skipped: skippedCount,
              failed: failedCount,
              defaultValue: '跳过 {{skipped}} · 失败 {{failed}}',
            })}
          </span>
          {newCount > 0 && (
            <span className={styles.newItemsBadge}>
              {t('cockpit.log.newItems', { count: newCount, defaultValue: '+{{count}}' })}
            </span>
          )}
        </span>
        <span className={styles.eventChevron}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className={styles.eventBody}>
          <div className={styles.eventToolbar}>
            <div className={styles.eventFilters}>
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.filterChip} ${filter === item.id ? styles.filterChipActive : ''}`}
                  onClick={() => setFilter(item.id)}
                >
                  {t(`cockpit.log.filters.${item.id}`, item.label)}
                </button>
              ))}
            </div>
            <div className={styles.sectionActions}>
              <button type="button" className={styles.smallButton} onClick={handlePause}>
                {paused ? t('cockpit.log.resume', '继续') : t('cockpit.log.pause', '暂停')}
              </button>
              <button
                type="button"
                className={styles.smallButton}
                onClick={onClear}
                disabled={busy}
              >
                {t('cockpit.log.clear', '清空')}
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.logEmpty}>{t('cockpit.log.empty', '暂无事件')}</div>
          ) : (
            <div className={styles.eventList}>
              {filtered.map((event) => (
                <div key={event.id} className={styles.eventItem}>
                  <span
                    className={`${styles.eventIcon} ${styles[`event_${event.kind.replace(':', '_')}`]}`}
                  >
                    {EVENT_ICONS[event.kind]}
                  </span>
                  <div className={styles.eventContent}>
                    <div className={styles.eventLine}>
                      <span className={styles.eventLabel}>
                        {t(`cockpit.log.kinds.${event.kind}`, EVENT_LABELS[event.kind])}
                      </span>
                      <span className={styles.eventTime}>{formatTime(event.timestamp)}</span>
                    </div>
                    <div className={styles.eventDescription}>{describeEvent(event)}</div>
                    {(event.sourceUrl || event.error) && (
                      <div className={styles.eventUrlRow}>
                        <span className={styles.eventUrl} title={event.sourceUrl || event.error}>
                          {event.sourceUrl || event.error}
                        </span>
                        <button
                          type="button"
                          className={styles.copyButton}
                          onClick={() => void handleCopy(event)}
                        >
                          {copiedId === event.id
                            ? t('cockpit.copied', '已复制')
                            : t('cockpit.copy', '复制')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default SessionEventLog;
