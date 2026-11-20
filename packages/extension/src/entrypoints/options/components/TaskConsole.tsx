import { memo, useMemo } from 'react';
import {
  Button,
  Card,
  Col,
  InputNumber,
  Popconfirm,
  Progress,
  Row,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type { QueueStatus, TaskTypeSummary } from '../../../shared/extension-runtime';
import type { TaskActionKey } from '../hooks/useTaskQueue';

const { Text } = Typography;

const TASK_TYPE_LABELS: Record<string, string> = {
  classify: 'AI 分类',
  rename: 'AI 重命名',
};

interface TypeRow extends TaskTypeSummary {
  key: string;
  label: string;
}

interface TaskConsoleProps {
  status: QueueStatus;
  loading?: boolean;
  busy: Record<TaskActionKey, boolean>;
  concurrency: number;
  onStart: () => Promise<void>;
  onPause: () => Promise<void>;
  onRetryFailed: () => Promise<void>;
  onClearQueue: () => Promise<void>;
  onRescan: () => Promise<void>;
  onConcurrencyChange: (value: number) => void;
}

/**
 * Consolidated async task console (classify + rename) for the Options page.
 */
const TaskConsole = memo(function TaskConsole({
  status,
  loading,
  busy,
  concurrency,
  onStart,
  onPause,
  onRetryFailed,
  onClearQueue,
  onRescan,
  onConcurrencyChange,
}: TaskConsoleProps) {
  const schedulerRunning = status.scheduler?.running ?? false;

  // Per-type rows; fall back to a single aggregate row when VFS does not
  // report a by-type breakdown.
  const typeRows = useMemo<TypeRow[]>(() => {
    const byType = status.byType;
    if (!byType || Object.keys(byType).length === 0) {
      return [
        {
          key: 'classify',
          label: TASK_TYPE_LABELS.classify,
          pending: status.pending,
          processing: status.processing,
          completed: status.completed,
          failed: status.failed,
          total: status.total,
        },
      ];
    }
    const preferred = ['classify', 'rename'];
    const keys = [
      ...preferred.filter((key) => byType[key] !== undefined),
      ...Object.keys(byType).filter((key) => !preferred.includes(key)),
    ];
    return keys.map((key) => ({ key, label: TASK_TYPE_LABELS[key] ?? key, ...byType[key] }));
  }, [status]);

  return (
    <Card className="options-card" title="AI 任务控制台" loading={loading}>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={8}>
          <Space direction="vertical" size={4}>
            <Text strong>处理状态</Text>
            <Space>
              <Switch
                checked={schedulerRunning}
                loading={busy.start || busy.pause}
                checkedChildren="运行中"
                unCheckedChildren="已暂停"
                onChange={(checked) => {
                  if (checked) {
                    void onStart();
                  } else {
                    void onPause();
                  }
                }}
              />
              <Tag color={schedulerRunning ? 'processing' : 'default'}>
                {schedulerRunning ? '运行中' : '已暂停'}
              </Tag>
            </Space>
            <Text type="secondary">暂停时可入队，但不会自动消费任务。</Text>
          </Space>
        </Col>

        <Col xs={24} md={8}>
          <Space direction="vertical" size={4}>
            <Text strong>并发数</Text>
            <InputNumber
              min={1}
              max={8}
              value={concurrency}
              onChange={(value) => {
                if (typeof value === 'number') onConcurrencyChange(value);
              }}
            />
          </Space>
        </Col>

        <Col xs={24} md={8}>
          <Statistic title="当前处理中" value={status.scheduler?.processing ?? status.processing} />
        </Col>
      </Row>

      <div style={{ marginTop: 24 }}>
        {typeRows.map((row) => {
          const percent = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
          const progressStatus =
            row.failed > 0 ? 'exception' : schedulerRunning ? 'active' : 'normal';
          return (
            <div key={row.key} style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text strong>{row.label}</Text>
                  <Text
                    type="secondary"
                    title={`待处理 ${row.pending} · 处理中 ${row.processing} · 已完成 ${row.completed} · 失败 ${row.failed}`}
                  >
                    {row.pending} 待处理 · {row.processing} 处理中 · {row.completed}/{row.total}{' '}
                    完成
                    {row.failed > 0 ? ` · ${row.failed} 失败` : ''}
                  </Text>
                </Space>
                <Progress
                  percent={percent}
                  status={progressStatus}
                  strokeColor={
                    row.failed > 0 ? undefined : schedulerRunning ? '#52c41a' : '#faad14'
                  }
                />
              </Space>
            </div>
          );
        })}
      </div>

      <Space wrap style={{ marginTop: 8 }}>
        <Button
          loading={busy.retry}
          disabled={status.failed === 0}
          onClick={() => void onRetryFailed()}
        >
          重试失败任务
        </Button>
        <Popconfirm
          title="清空任务队列"
          description="这会删除当前队列记录，确定继续吗？"
          okText="清空"
          cancelText="取消"
          onConfirm={() => void onClearQueue()}
        >
          <Button danger loading={busy.clear}>
            清空队列
          </Button>
        </Popconfirm>
        <Popconfirm
          title="全量重扫"
          description="重新扫描全部媒体的分类与命名（classify + rename），确定继续吗？"
          okText="重扫"
          cancelText="取消"
          onConfirm={() => void onRescan()}
        >
          <Button loading={busy.rescan}>全量重扫</Button>
        </Popconfirm>
      </Space>
    </Card>
  );
});

export default TaskConsole;
