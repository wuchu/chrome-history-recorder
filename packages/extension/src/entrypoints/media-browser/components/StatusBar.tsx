import { memo } from 'react';
import { Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  SettingOutlined,
} from '@ant-design/icons';
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
  captureCount?: number;
  failedCount?: number;
  captureError?: string;
  onToggleCapture: () => void;
  onOpenOptions: () => void;
  onClearEvents: () => void;
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
  captureCount,
  failedCount,
  captureError,
  onToggleCapture,
  onOpenOptions,
  onClearEvents,
}: StatusBarProps) {
  const { t } = useTranslation();

  const vfsClass = vfsConnected ? styles.vfsConnected : styles.vfsDisconnected;

  const ollamaClass = ollamaAvailable ? styles.ollamaAvailable : styles.ollamaUnavailable;

  return (
    <div className={styles.container}>
      <div className={styles.leftSection}>
        <div className={styles.serviceStatus}>
          <div
            className={`${styles.statusDot} ${serviceOnline ? styles.online : styles.offline}`}
          />
          <span>服务</span>
        </div>

        {/* VFS 连接状态 */}
        {vfsConnected !== undefined && (
          <div className={styles.vfsStatus}>
            <span className={`${styles.statusDot} ${vfsClass}`} />
            <span className={styles.vfsText}>VFS</span>
          </div>
        )}

        {/* Ollama 状态 */}
        {ollamaAvailable !== undefined && (
          <div className={styles.ollamaStatus}>
            <span className={`${styles.statusDot} ${ollamaClass}`} />
            <span className={styles.ollamaText}>Ollama</span>
          </div>
        )}

        {/* 分隔符 */}
        {(captureCount !== undefined ||
          failedCount !== undefined ||
          (classifyQueue &&
            (classifyQueue.pending + classifyQueue.processing > 0 ||
              classifyQueue.completed > 0))) && <span className={styles.separator}>|</span>}

        {/* 捕获统计 - 只要有值就显示，包括 0 */}
        {captureCount !== undefined || failedCount !== undefined ? (
          <>
            {captureCount !== undefined && (
              <div className={styles.captureStats}>
                <span className={styles.captureSuccessIcon}>✅</span>
                <span className={styles.captureCountText}>{captureCount}</span>
              </div>
            )}
            {failedCount !== undefined && (
              <div className={styles.captureStats}>
                {captureError ? (
                  <Tooltip title={captureError}>
                    <span className={styles.captureErrorIcon}>❌</span>
                  </Tooltip>
                ) : (
                  <span className={styles.captureErrorIcon}>❌</span>
                )}
                <span className={styles.captureCountText}>{failedCount}</span>
              </div>
            )}
            <span className={styles.separator}>|</span>
          </>
        ) : null}

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

      <div className={styles.rightSection}>
        <Tooltip
          title={
            isCapturing ? t('status.stopCapture', '停止捕获') : t('status.startCapture', '开始捕获')
          }
        >
          <button
            onClick={onToggleCapture}
            className={`${styles.iconButton} ${isCapturing ? styles.active : ''}`}
            disabled={!serviceOnline}
          >
            {isCapturing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          </button>
        </Tooltip>

        <Tooltip title={t('status.clearEvents', '清空事件')}>
          <button onClick={onClearEvents} className={styles.iconButton}>
            <ClearOutlined />
          </button>
        </Tooltip>

        <Tooltip title={t('status.settings', '设置')}>
          <button onClick={onOpenOptions} className={styles.iconButton}>
            <SettingOutlined />
          </button>
        </Tooltip>
      </div>
    </div>
  );
});

export default StatusBar;
