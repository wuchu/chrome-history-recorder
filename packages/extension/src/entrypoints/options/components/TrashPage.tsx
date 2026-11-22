import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Modal, Space, Spin, Tag, Typography, message } from 'antd';
import { MediaDetail, VirtualMasonryGrid } from '../../media-browser/components';
import {
  useBackgroundMessaging,
  useHistoricalImages,
  useTheme,
  type BackgroundEvent,
  type CombinedMediaItem,
} from '../../media-browser/hooks';
import { appStyles } from '../../media-browser/styles';
import styles from './MediaLibrary.module.css';

const { Text, Title } = Typography;

interface ListResponse {
  success?: boolean;
  data?: { trashSize?: number; trashFiles?: number };
  trashSize?: number;
}

interface RpcResponse {
  success?: boolean;
  data?: { success?: boolean; count?: number } | null;
  count?: number;
}

/**
 * Recycle-bin page for the Options console.
 *
 * Trashed media keeps its blob, thumbnails, and archived copy so it can be
 * restored or previewed. Permanent delete and empty-trash release the storage.
 */
export function TrashPage() {
  const [selectedItem, setSelectedItem] = useState<CombinedMediaItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [trashSize, setTrashSize] = useState(0);
  const [busy, setBusy] = useState(false);
  const eventHandlerRef = useRef<(event: BackgroundEvent) => void>(() => {});
  const onEvent = useCallback((event: BackgroundEvent) => {
    eventHandlerRef.current(event);
  }, []);
  const { vfsConnected, sendMessage } = useBackgroundMessaging({
    collectEvents: false,
    onEvent,
  });
  const theme = useTheme();

  const trash = useHistoricalImages({
    limit: 50,
    autoLoad: true,
    status: 'trashed',
    orderBy: 'deleted_at',
    order: 'desc',
  });

  const refreshTrash = trash.refresh;

  const loadStats = useCallback(async () => {
    try {
      const response = (await sendMessage({ type: 'getStats' })) as ListResponse | undefined;
      const data = response?.data ?? response;
      setTrashSize(data?.trashSize ?? 0);
    } catch (error) {
      console.error('[Trash] Failed to load stats:', error);
    }
  }, [sendMessage]);

  useEffect(() => {
    eventHandlerRef.current = (event: BackgroundEvent) => {
      if (
        event.type === 'file:restored' ||
        event.type === 'file:purged' ||
        event.type === 'trash:emptied' ||
        event.type === 'trash:restored-all'
      ) {
        refreshTrash();
        void loadStats();
      }
    };
  }, [refreshTrash, loadStats]);

  useEffect(() => {
    if (!selectedItem) return;
    if (!trash.items.some((item) => item.hash === selectedItem.hash)) {
      setSelectedItem(null);
    }
  }, [trash.items, selectedItem]);

  const handleRestore = useCallback(
    async (hash: string) => {
      try {
        const result = (await sendMessage({ type: 'restoreFile', hash })) as RpcResponse | null;
        if (!rpcSucceeded(result)) {
          message.error('恢复失败');
        }
        if (selectedItem?.hash === hash) setSelectedItem(null);
        refreshTrash();
        void loadStats();
      } catch (error) {
        console.error('[Trash] Failed to restore item:', error);
        message.error('恢复失败');
      }
    },
    [selectedItem, sendMessage, refreshTrash, loadStats]
  );

  const handlePurge = useCallback(
    async (hash: string) => {
      setBusy(true);
      try {
        const result = (await sendMessage({ type: 'purgeFile', hash })) as RpcResponse | null;
        if (!rpcSucceeded(result)) {
          message.error('永久删除失败');
        }
        if (selectedItem?.hash === hash) setSelectedItem(null);
        refreshTrash();
        void loadStats();
      } catch (error) {
        console.error('[Trash] Failed to purge item:', error);
        message.error('永久删除失败');
      } finally {
        setBusy(false);
      }
    },
    [selectedItem, sendMessage, refreshTrash, loadStats]
  );

  const requestPurge = useCallback(
    (hash: string) => {
      Modal.confirm({
        title: '永久删除',
        content: '该媒体将从磁盘永久删除，归档副本也会被删除，且无法恢复。确定继续吗？',
        okText: '永久删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => handlePurge(hash),
      });
    },
    [handlePurge]
  );

  const selectedItems = trash.items.filter((item) => selectedHashes.has(item.hash));

  const toggleSelect = useCallback((hash: string) => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  const handleRestoreSelected = useCallback(() => {
    if (selectedItems.length === 0) return;
    Modal.confirm({
      title: '恢复选中的媒体',
      content: `将恢复选中的 ${selectedItems.length} 个媒体。确定继续吗？`,
      okText: '恢复',
      cancelText: '取消',
      onOk: async () => {
        setBusy(true);
        let failed = 0;
        try {
          for (const item of selectedItems) {
            try {
              const result = (await sendMessage({
                type: 'restoreFile',
                hash: item.hash,
              })) as RpcResponse | null;
              if (!rpcSucceeded(result)) failed += 1;
            } catch {
              failed += 1;
            }
          }
          setSelectedHashes(new Set());
          refreshTrash();
          void loadStats();
          if (failed > 0) message.warning(`${failed} 个媒体恢复失败`);
          else message.success(`已恢复 ${selectedItems.length} 个媒体`);
        } finally {
          setBusy(false);
        }
      },
    });
  }, [selectedItems, sendMessage, refreshTrash, loadStats]);

  const handlePurgeSelected = useCallback(() => {
    if (selectedItems.length === 0) return;
    Modal.confirm({
      title: '永久删除选中的媒体',
      content: `将永久删除选中的 ${selectedItems.length} 个媒体及其归档副本，且无法恢复。确定继续吗？`,
      okText: '永久删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setBusy(true);
        let failed = 0;
        try {
          for (const item of selectedItems) {
            try {
              const result = (await sendMessage({
                type: 'purgeFile',
                hash: item.hash,
              })) as RpcResponse | null;
              if (!rpcSucceeded(result)) failed += 1;
            } catch {
              failed += 1;
            }
          }
          setSelectedHashes(new Set());
          refreshTrash();
          void loadStats();
          if (failed > 0) message.warning(`${failed} 个媒体永久删除失败`);
          else message.success(`已永久删除 ${selectedItems.length} 个媒体`);
        } finally {
          setBusy(false);
        }
      },
    });
  }, [selectedItems, sendMessage, refreshTrash, loadStats]);

  const handleRestoreAll = useCallback(() => {
    Modal.confirm({
      title: '恢复全部',
      content: `将恢复回收站中的全部 ${trash.total} 个媒体。确定继续吗？`,
      okText: '恢复全部',
      cancelText: '取消',
      onOk: async () => {
        setBusy(true);
        try {
          const result = (await sendMessage({ type: 'restoreAll' })) as {
            success?: boolean;
            count?: number;
          } | null;
          if (!result?.success) {
            message.error('恢复全部失败');
          } else {
            message.success(`已恢复 ${result.count ?? 0} 个媒体`);
          }
        } catch (error) {
          console.error('[Trash] Failed to restore all:', error);
          message.error('恢复全部失败');
        } finally {
          setBusy(false);
        }
      },
    });
  }, [sendMessage, trash.total]);

  const handleEmptyTrash = useCallback(() => {
    Modal.confirm({
      title: '清空回收站',
      content: `将永久删除回收站中的全部 ${trash.total} 个媒体，归档副本也会被删除，且无法恢复。确定继续吗？`,
      okText: '清空回收站',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setBusy(true);
        try {
          const result = (await sendMessage({ type: 'emptyTrash' })) as {
            success?: boolean;
            count?: number;
          } | null;
          if (!result?.success) {
            message.error('清空回收站失败');
          } else {
            message.success(`已永久删除 ${result.count ?? 0} 个媒体`);
          }
        } catch (error) {
          console.error('[Trash] Failed to empty trash:', error);
          message.error('清空回收站失败');
        } finally {
          setBusy(false);
        }
      },
    });
  }, [sendMessage, trash.total]);

  const themeClass = theme.themeClass(appStyles.lightTheme, appStyles.darkTheme);
  const showInitialLoading = trash.loading && trash.items.length === 0;

  return (
    <div className={styles.library}>
      <div className={styles.header}>
        <div>
          <Title level={4} className={styles.title}>
            回收站
          </Title>
          <Text type="secondary">
            移入回收站的媒体会保留原始文件、缩略图和归档副本，可随时恢复或永久删除。
          </Text>
        </div>
        <Space wrap>
          <Tag>共 {trash.total} 个</Tag>
          <Tag>占用 {formatSize(trashSize)}</Tag>
          <Tag color={vfsConnected ? 'green' : 'red'}>
            {vfsConnected ? 'VFS 已连接' : 'VFS 未连接'}
          </Tag>
          <Button onClick={refreshTrash} loading={trash.loading}>
            刷新
          </Button>
          <Button
            onClick={() => {
              setSelectionMode((prev) => !prev);
              setSelectedHashes(new Set());
            }}
          >
            {selectionMode ? '退出选择' : '选择'}
          </Button>
          <Button onClick={handleRestoreAll} disabled={busy || trash.total === 0}>
            恢复全部
          </Button>
          <Button danger onClick={handleEmptyTrash} disabled={busy || trash.total === 0}>
            清空回收站
          </Button>
        </Space>
      </div>

      {!vfsConnected && (
        <Alert
          type="warning"
          showIcon
          message="VFS 未连接，回收站内容可能不是最新的。"
          style={{ marginBottom: 12 }}
        />
      )}

      {trash.error && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={trash.error} />
      )}

      <div className={`${appStyles.panel} ${themeClass} ${styles.mediaSurface}`}>
        {selectionMode && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              marginBottom: 8,
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: 8,
            }}
          >
            <Text strong>已选 {selectedHashes.size} 项</Text>
            <Button
              size="small"
              onClick={() => setSelectedHashes(new Set(trash.items.map((item) => item.hash)))}
            >
              全选当前
            </Button>
            <Button size="small" onClick={() => setSelectedHashes(new Set())}>
              清空
            </Button>
            <Button
              size="small"
              disabled={!selectedHashes.size || busy}
              onClick={handleRestoreSelected}
            >
              恢复选中
            </Button>
            <Button
              size="small"
              danger
              disabled={!selectedHashes.size || busy}
              onClick={handlePurgeSelected}
            >
              永久删除选中
            </Button>
          </div>
        )}
        {showInitialLoading ? (
          <div className={styles.loading}>
            <Spin tip="加载回收站中…" />
          </div>
        ) : trash.items.length === 0 ? (
          <Empty description="回收站是空的" style={{ padding: 48 }} />
        ) : (
          <VirtualMasonryGrid
            items={trash.items}
            onLoadMore={trash.loadMore}
            onItemClick={setSelectedItem}
            onItemDeleteRequest={requestPurge}
            hasMore={trash.hasMore}
            loading={trash.loading}
            selectionMode={selectionMode}
            selectedHashes={selectedHashes}
            onToggleSelect={toggleSelect}
            emptyMessage="回收站是空的"
          />
        )}
      </div>

      {selectedItem && (
        <MediaDetail
          item={selectedItem}
          mode="trash"
          onClose={() => setSelectedItem(null)}
          onRestore={handleRestore}
          onPurgeRequest={requestPurge}
          onNavigate={(direction) => {
            const index = trash.items.findIndex((item) => item.hash === selectedItem.hash);
            const nextIndex = direction === 'prev' ? index - 1 : index + 1;
            if (index >= 0 && nextIndex >= 0 && nextIndex < trash.items.length) {
              setSelectedItem(trash.items[nextIndex]);
            }
          }}
          hasPrev={
            selectedItem
              ? trash.items.findIndex((item) => item.hash === selectedItem.hash) > 0
              : false
          }
          hasNext={
            selectedItem
              ? trash.items.findIndex((item) => item.hash === selectedItem.hash) <
                trash.items.length - 1
              : false
          }
        />
      )}
    </div>
  );
}

function rpcSucceeded(response: RpcResponse | null | undefined): boolean {
  return response?.data?.success ?? response?.success ?? false;
}

function formatSize(bytes: number): string {
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

export default TrashPage;
