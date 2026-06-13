import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  serviceOnline: boolean;
  isCapturing: boolean;
  vfsConnected?: boolean;
  ollamaAvailable?: boolean;
  classifyQueue?: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  onToggleCapture: () => void;
}

/**
 * 状态栏组件
 * 规则: rerender-memo - 使用 memo 避免不必要的重渲染
 */
const StatusBar = memo(function StatusBar({
  serviceOnline,
  isCapturing,
  vfsConnected,
  ollamaAvailable,
  classifyQueue,
  onToggleCapture,
}: StatusBarProps) {
  const { t } = useTranslation();

  const vfsStatus = vfsConnected ? 'connected' : 'disconnected';
  const vfsIcon = vfsConnected ? '●' : '○';
  const vfsClass = vfsConnected ? styles.vfsConnected : styles.vfsDisconnected;

  const ollamaIcon = ollamaAvailable ? '●' : '○';
  const ollamaClass = ollamaAvailable ? styles.ollamaAvailable : styles.ollamaUnavailable;

  return (
    <div className={styles.container}>
      <div className={styles.leftSection}>
        <div className={styles.serviceStatus}>
          <div className={`${styles.statusDot} ${serviceOnline ? styles.online : styles.offline}`} />
          <span>{serviceOnline ? t('status.serviceOnline') : t('status.serviceOffline')}</span>
        </div>

        {/* VFS 连接状态 */}
        {vfsConnected !== undefined && (
          <div className={styles.vfsStatus}>
            <span className={`${styles.vfsIcon} ${vfsClass}`}>{vfsIcon}</span>
            <span className={styles.vfsText}>
              {vfsConnected ? t('status.vfsConnected', 'VFS 已连接') : t('status.vfsDisconnected', 'VFS 断开')}
            </span>
          </div>
        )}

        {/* Ollama 状态 */}
        {ollamaAvailable !== undefined && (
          <div className={styles.ollamaStatus}>
            <span className={`${styles.ollamaIcon} ${ollamaClass}`}>{ollamaIcon}</span>
            <span className={styles.ollamaText}>
              {ollamaAvailable ? t('status.ollamaAvailable', 'Ollama 可用') : t('status.ollamaUnavailable', 'Ollama 不可用')}
            </span>
          </div>
        )}

        {/* 分类队列状态 */}
        {classifyQueue && classifyQueue.pending + classifyQueue.processing > 0 && (
          <div className={styles.classifyStatus}>
            <span className={styles.classifyIcon}>◉</span>
            <span className={styles.classifyText}>
              {t('status.classifying', {
                count: classifyQueue.processing,
                pending: classifyQueue.pending,
              })}
            </span>
          </div>
        )}

        {/* 已分类数量 */}
        {classifyQueue && classifyQueue.completed > 0 && (
          <div className={styles.completedCount}>
            <span className={styles.completedIcon}>✓</span>
            <span className={styles.completedText}>{classifyQueue.completed}</span>
          </div>
        )}
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
