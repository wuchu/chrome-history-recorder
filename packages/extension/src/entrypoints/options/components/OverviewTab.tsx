import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd';
import {
  getCaptureSession,
  getMediaStats,
  type CaptureSessionSnapshot,
  type MediaStats,
  type QueueStatus,
  type ServiceStatus,
} from '../../../shared/extension-runtime';
import { useHistoricalImages } from '../../media-browser/hooks/useHistoricalImages';
import { buildVfsThumbnailUrl } from '../../media-browser/utils/media';
import styles from './OverviewTab.module.css';

const { Text } = Typography;

interface OverviewTabProps {
  serviceStatus: ServiceStatus;
  queueStatus: QueueStatus;
  onRefresh: () => void;
  onOpenLibrary: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function RecentThumb({ hash, mimeType }: { hash: string; mimeType: string }) {
  const [failed, setFailed] = useState(false);
  const isVideo = mimeType.startsWith('video/');

  if (!isVideo) {
    return <img src={buildVfsThumbnailUrl(hash, 'small')} alt="" loading="lazy" />;
  }

  if (failed) {
    return <span className={styles.recentVideo}>🎬</span>;
  }

  return (
    <>
      <img
        src={buildVfsThumbnailUrl(hash, 'small')}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
      <span className={styles.recentPlayBadge} aria-hidden="true">
        ▶
      </span>
    </>
  );
}

export function OverviewTab({
  serviceStatus,
  queueStatus,
  onRefresh,
  onOpenLibrary,
}: OverviewTabProps) {
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [sessionSnapshot, setSessionSnapshot] = useState<CaptureSessionSnapshot | null>(null);
  const recent = useHistoricalImages({ limit: 12, autoLoad: true });

  const loadStats = useCallback(async () => {
    try {
      const next = await getMediaStats();
      setStats(next);
      setStatsError(null);
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : '加载统计失败');
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const next = await getCaptureSession();
      setSessionSnapshot(next);
    } catch {
      setSessionSnapshot(null);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadSession();

    const listener = (message: { type?: string; data?: unknown }) => {
      if (message.type === 'capture:session' && message.data) {
        setSessionSnapshot(message.data as CaptureSessionSnapshot);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [loadSession, loadStats]);

  const refreshAll = useCallback(() => {
    onRefresh();
    void loadStats();
    void loadSession();
    recent.refresh();
  }, [loadSession, loadStats, onRefresh, recent]);

  const activeSession =
    sessionSnapshot?.session?.status === 'capturing' ? sessionSnapshot.session : null;
  const uncategorized = stats?.byCategory?.uncategorized ?? 0;

  const recentItems = useMemo(() => recent.items.slice(0, 12), [recent.items]);

  return (
    <div className={styles.overview}>
      <div className={styles.header}>
        <div>
          <Typography.Title level={4} className={styles.title}>
            概览
          </Typography.Title>
          <Text type="secondary">本地服务、存储、AI 队列和最近捕获的全局状态。</Text>
        </div>
        <Button onClick={refreshAll} loading={recent.loading}>
          刷新
        </Button>
      </div>

      {statsError && (
        <Alert type="error" showIcon message={statsError} style={{ marginBottom: 12 }} />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="服务状态" className={styles.card}>
            <Space direction="vertical" size={6}>
              <Space>
                <Tag color={serviceStatus.vfsConnected ? 'green' : 'red'}>VFS</Tag>
                <Text>{serviceStatus.vfsConnected ? '已连接' : '未连接'}</Text>
              </Space>
              <Space>
                <Tag color={serviceStatus.ollamaAvailable ? 'green' : 'orange'}>Ollama</Tag>
                <Text>{serviceStatus.ollamaAvailable ? '可用' : '不可用'}</Text>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="存储与媒体" className={styles.card}>
            <Row gutter={[16, 12]}>
              <Col span={8}>
                <Statistic title="媒体总数" value={stats?.totalFiles ?? 0} />
              </Col>
              <Col span={8}>
                <Statistic title="图片" value={stats?.images ?? 0} />
              </Col>
              <Col span={8}>
                <Statistic title="视频" value={stats?.videos ?? 0} />
              </Col>
              <Col span={8}>
                <Statistic title="占用" value={formatBytes(stats?.totalSize ?? 0)} />
              </Col>
              <Col span={8}>
                <Statistic title="未分类" value={uncategorized} />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="AI 队列" className={styles.card}>
            <Row gutter={[16, 12]}>
              <Col flex="1">
                <Statistic title="等待" value={queueStatus.pending} />
              </Col>
              <Col flex="1">
                <Statistic title="处理中" value={queueStatus.processing} />
              </Col>
              <Col flex="1">
                <Statistic title="完成" value={queueStatus.completed} />
              </Col>
              <Col flex="1">
                <Statistic title="跳过" value={queueStatus.skipped} />
              </Col>
              <Col flex="1">
                <Statistic title="失败" value={queueStatus.failed} />
              </Col>
            </Row>
            <div className={styles.queueMeta}>
              <Tag color={queueStatus.scheduler?.running ? 'processing' : 'default'}>
                {queueStatus.scheduler?.running ? '调度器运行中' : '调度器已暂停'}
              </Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="当前捕获会话" className={styles.card}>
            {activeSession ? (
              <Space direction="vertical" size={4}>
                <Text strong ellipsis={{ tooltip: activeSession.pageUrl }}>
                  {activeSession.tabTitle || activeSession.pageUrl}
                </Text>
                <Text type="secondary" ellipsis={{ tooltip: activeSession.origin }}>
                  {activeSession.origin}
                </Text>
                <Space wrap>
                  <Tag color="blue">捕获中</Tag>
                  <Text>已保存 {activeSession.counters.saved}</Text>
                  <Text type="secondary">失败 {activeSession.counters.failed}</Text>
                </Space>
                <Text type="secondary" className={styles.readOnlyHint}>
                  捕获开关仍然在侧边栏中操作。
                </Text>
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有捕获会话" />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="最近捕获"
        className={styles.card}
        extra={
          <Button type="link" onClick={onOpenLibrary}>
            打开媒体库
          </Button>
        }
      >
        {recent.loading && recent.items.length === 0 ? (
          <div className={styles.recentLoading}>加载中…</div>
        ) : recentItems.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无捕获" />
        ) : (
          <div className={styles.recentGrid}>
            {recentItems.map((item) => (
              <button
                key={item.hash}
                type="button"
                className={styles.recentItem}
                title={item.sourceUrl || item.hash}
                onClick={() => {
                  window.location.hash = '#library';
                }}
              >
                <RecentThumb hash={item.hash} mimeType={item.mimeType} />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default OverviewTab;
