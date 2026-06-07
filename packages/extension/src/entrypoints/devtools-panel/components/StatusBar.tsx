import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  serviceOnline: boolean;
  isCapturing: boolean;
  onToggleCapture: () => void;
}

/**
 * 状态栏组件
 * 规则: rerender-memo - 使用 memo 避免不必要的重渲染
 */
const StatusBar = memo(function StatusBar({ serviceOnline, isCapturing, onToggleCapture }: StatusBarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.serviceStatus}>
        <div
          className={`${styles.statusDot} ${serviceOnline ? styles.online : styles.offline}`}
        />
        <span>{serviceOnline ? t('status.serviceOnline') : t('status.serviceOffline')}</span>
      </div>
      <div className={styles.captureStatus}>
        <button
          onClick={onToggleCapture}
          className={`${styles.captureButton} ${isCapturing ? styles.active : ''}`}
          disabled={!serviceOnline}
        >
          {isCapturing ? t('status.stopCapture') : t('status.startCapture')}
        </button>
      </div>
    </div>
  );
});

export default StatusBar;