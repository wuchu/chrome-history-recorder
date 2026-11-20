import { useTranslation } from 'react-i18next';
import type { CaptureSession } from '../../../shared/extension-runtime';
import styles from '../cockpit.module.css';

interface SessionBannerProps {
  session: CaptureSession;
  busy?: boolean;
  onSwitch: () => void;
  onStop: () => void;
}

export function SessionBanner({ session, busy, onSwitch, onStop }: SessionBannerProps) {
  const { t } = useTranslation();
  const hostname = (() => {
    try {
      return new URL(session.pageUrl).hostname;
    } catch {
      return session.origin;
    }
  })();

  return (
    <div className={styles.banner}>
      <div className={styles.bannerText}>
        <span className={styles.bannerTitle}>
          {t('cockpit.otherTabTitle', '另一个标签页正在捕获')}
        </span>
        <span className={styles.bannerDetail} title={session.tabTitle || session.pageUrl}>
          {session.tabTitle || hostname || t('cockpit.unknownPage', '未知页面')}
          {session.counters.saved > 0
            ? ` · ${t('cockpit.savedCount', { count: session.counters.saved, defaultValue: '已保存 {{count}}' })}`
            : ''}
        </span>
      </div>
      <div className={styles.bannerActions}>
        <button type="button" className={styles.secondaryButton} onClick={onSwitch}>
          {t('cockpit.switchToSession', '切换过去')}
        </button>
        <button type="button" className={styles.dangerButton} onClick={onStop} disabled={busy}>
          {t('cockpit.stopSession', '停止会话')}
        </button>
      </div>
    </div>
  );
}

export default SessionBanner;
