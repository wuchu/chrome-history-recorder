import { useTranslation } from 'react-i18next';
import type { ActiveTabInfo } from '../hooks/useActiveTab';
import styles from '../cockpit.module.css';

interface StartStateProps {
  tab: ActiveTabInfo;
  busy?: boolean;
  onStart: () => void;
}

export function StartState({ tab, busy, onStart }: StartStateProps) {
  const { t } = useTranslation();
  const disabled = !tab.isSupported || tab.loading || tab.tabId === null;

  return (
    <section className={styles.startPanel}>
      <div className={styles.startCard}>
        <div className={styles.startIcon}>{tab.isSupported ? '🎯' : '🚫'}</div>
        <div className={styles.startTitle}>
          {tab.isSupported
            ? t('cockpit.start.title', '开始监控这个标签页')
            : t('cockpit.start.unsupportedTitle', '此页面无法捕获')}
        </div>
        <div className={styles.startText}>
          {tab.isSupported
            ? t(
                'cockpit.start.description',
                '捕获只会监控当前标签页，并在会话结束时给出本次的保存、跳过和失败统计。'
              )
            : t(
                'cockpit.start.unsupportedDescription',
                'Chrome 不允许扩展捕获此页面。请切换到普通网页后再试。'
              )}
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onStart}
          disabled={disabled || busy}
        >
          {busy ? t('cockpit.start.starting', '正在开始…') : t('cockpit.start.action', '开始捕获')}
        </button>
        <div className={styles.startHint}>
          {t('cockpit.start.hint', '全局同时只会运行一个捕获会话。')}
        </div>
      </div>
    </section>
  );
}

export default StartState;
