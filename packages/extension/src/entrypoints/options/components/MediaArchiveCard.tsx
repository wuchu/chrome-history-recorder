import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Progress,
  Space,
  Switch,
  Typography,
} from 'antd';
import type { MediaArchiveStatus } from '../../../shared/extension-runtime';

const { Paragraph, Text } = Typography;

export interface MediaArchiveTaskSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface MediaArchiveCardProps {
  status: MediaArchiveStatus | null;
  summary?: MediaArchiveTaskSummary | null;
  savingSave: boolean;
  savingRun: boolean;
  onRefresh: () => void;
  onToggle: (enabled: boolean, targetPath: string, intervalMinutes: number) => void;
  onSave: (targetPath: string, intervalMinutes: number) => void;
  onRun: () => void;
}

export default function MediaArchiveCard({
  status,
  summary,
  savingSave,
  savingRun,
  onRefresh,
  onToggle,
  onSave,
  onRun,
}: MediaArchiveCardProps) {
  const [targetDraft, setTargetDraft] = useState(status?.targetPath ?? '');
  const [intervalDraft, setIntervalDraft] = useState(status?.intervalMinutes ?? 5);

  useEffect(() => {
    setTargetDraft(status?.targetPath ?? '');
  }, [status?.targetPath]);

  useEffect(() => {
    if (status) {
      setIntervalDraft(status.intervalMinutes);
    }
  }, [status?.intervalMinutes]);

  return (
    <Card
      className="options-card"
      title="媒体归档"
      extra={
        <Button loading={savingSave} onClick={onRefresh}>
          刷新
        </Button>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        把启用后新增的图片和视频复制到指定目录（例如 NAS
        挂载点）。每个文件是一条「媒体归档」任务，可在任务页查看进度。目标文件使用内容哈希命名，只增不删；首次启用之前捕获的媒体不会归档。
      </Paragraph>

      {!status ? (
        <Alert
          type="info"
          showIcon
          message="未连接后端"
          description="连接后端后可以配置媒体归档。"
        />
      ) : (
        <Form layout="vertical">
          <Form.Item label="启用归档">
            <Switch
              checked={status.enabled}
              loading={savingSave}
              onChange={(checked) => onToggle(checked, targetDraft.trim(), intervalDraft)}
            />
          </Form.Item>

          <Form.Item
            label="目标目录"
            extra="必须是已存在的绝对路径；NAS 需先挂载，应用不会自动创建目录。"
          >
            <Space.Compact className="full-width">
              <Input
                aria-label="归档目标目录"
                value={targetDraft}
                placeholder="例如 /Volumes/personal_folder/Private/VFS-media"
                onChange={(event) => setTargetDraft(event.target.value)}
                onPressEnter={() => onSave(targetDraft.trim(), intervalDraft)}
              />
              <Button
                type="primary"
                loading={savingSave}
                onClick={() => onSave(targetDraft.trim(), intervalDraft)}
              >
                保存
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item label="扫描间隔（分钟）" extra="范围 1–1440；启用后会先立即扫描一次。">
            <InputNumber
              aria-label="扫描间隔分钟"
              min={1}
              max={1440}
              value={intervalDraft}
              style={{ width: 160 }}
              onChange={(value) => setIntervalDraft(typeof value === 'number' ? value : 5)}
            />
          </Form.Item>

          <Form.Item label="整体进度">
            <Space direction="vertical" size={6} className="full-width">
              <Progress
                percent={
                  summary && summary.total > 0
                    ? Math.round((summary.completed / summary.total) * 100)
                    : 0
                }
                status={
                  summary && summary.failed > 0 ? 'exception' : status.running ? 'active' : 'normal'
                }
              />
              <Text type="secondary">
                {summary && summary.total > 0
                  ? `已完成 ${summary.completed} / ${summary.total} · 处理中 ${summary.processing} · 待处理 ${summary.pending}${
                      summary.failed > 0 ? ` · 失败 ${summary.failed}` : ''
                    }`
                  : '暂无归档任务'}
              </Text>
            </Space>
          </Form.Item>

          <Form.Item label="状态">
            <Space direction="vertical" size={4}>
              <Text>
                {status.running
                  ? '正在归档…'
                  : status.lastRunAt
                    ? `上次运行：${new Date(status.lastRunAt).toLocaleString()}`
                    : '尚未运行'}
              </Text>
              {status.pendingCount > 0 && (
                <Text type="secondary">待处理任务：{status.pendingCount}</Text>
              )}
              {status.failedCount > 0 && <Text type="warning">失败任务：{status.failedCount}</Text>}
              {status.lastError && <Text type="danger">最后错误：{status.lastError}</Text>}
            </Space>
          </Form.Item>

          <Space>
            <Button
              loading={savingRun}
              disabled={!status.enabled || status.running}
              onClick={onRun}
            >
              立即归档
            </Button>
          </Space>

          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="只归档首次启用后新增的媒体"
            description="归档任务独立于分类暂停运行；停用后重新启用会补上停用期间的新增，更换目标目录会把启用以来缺失的文件补到新目标。"
          />
        </Form>
      )}
    </Card>
  );
}
