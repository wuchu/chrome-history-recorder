import { memo, useMemo } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Input,
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
import type { PromptTemplates } from '../../../shared/prompt-templates';
import type { AiTaskType, TaskActionKey } from '../hooks/useTaskQueue';

const { Text } = Typography;
const { TextArea } = Input;

const TASK_TYPE_LABELS: Record<string, string> = {
  classify: 'AI 分类',
  rename: 'AI 重命名',
  archive: '媒体归档',
};

const TEMPLATE_META: Record<'classify' | 'rename', { placeholder: string; description: string }> = {
  classify: {
    placeholder: '{{vocabulary}}',
    description: '占位符 {{vocabulary}} 会替换为现有标签词表。',
  },
  rename: {
    placeholder: '观察这张图片，为它生成一个简洁生动的文件名…',
    description: '命名风格直接写在模板里，无需额外占位符。',
  },
};

type TemplateKey = keyof PromptTemplates;

interface TypeRow extends TaskTypeSummary {
  key: string;
  label: string;
}

interface TaskConsoleProps {
  status: QueueStatus;
  loading?: boolean;
  busy: Record<TaskActionKey, boolean>;
  concurrency: Record<AiTaskType, number>;
  templateDrafts: Record<TemplateKey, string>;
  onStart: (taskType: AiTaskType) => Promise<void>;
  onPause: (taskType: AiTaskType) => Promise<void>;
  onRetryFailed: (taskType: AiTaskType) => Promise<void>;
  onClearQueue: (taskType: AiTaskType) => Promise<void>;
  onRescan: (taskType: AiTaskType) => Promise<void>;
  onConcurrencyChange: (taskType: AiTaskType, value: number) => void;
  onTemplateChange: (key: TemplateKey, value: string) => void;
  onTemplateSave: (key: TemplateKey) => void;
  onTemplateReset: (key: TemplateKey) => void;
}

function isTemplateKey(key: string): key is 'classify' | 'rename' {
  return key === 'classify' || key === 'rename';
}

function isAiTaskType(key: string): key is AiTaskType {
  return key === 'classify' || key === 'rename';
}

/**
 * Async AI task console for the Options page.
 *
 * Each AI task type owns its run/pause switch, concurrency limit, progress,
 * prompt template, and maintenance actions. The archive type has its own card
 * elsewhere in the Tasks section.
 */
const TaskConsole = memo(function TaskConsole({
  status,
  loading,
  busy,
  concurrency,
  templateDrafts,
  onStart,
  onPause,
  onRetryFailed,
  onClearQueue,
  onRescan,
  onConcurrencyChange,
  onTemplateChange,
  onTemplateSave,
  onTemplateReset,
}: TaskConsoleProps) {
  // One card per AI task type. Older backends only report an aggregate; in
  // that case show it on the classify card and zeroes for the rest.
  const typeRows = useMemo<TypeRow[]>(() => {
    const byType = status.byType;
    const empty: TaskTypeSummary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    };
    const aggregate: TaskTypeSummary = {
      pending: status.pending,
      processing: status.processing,
      completed: status.completed,
      failed: status.failed,
      skipped: status.skipped,
      total: status.total,
    };
    const keys = [
      'classify',
      'rename',
      // Archive tasks have their own card above the task console.
      ...Object.keys(byType ?? {}).filter(
        (key) => key !== 'classify' && key !== 'rename' && key !== 'archive'
      ),
    ];

    return keys.map((key) => {
      const summary =
        byType?.[key] ?? (byType === undefined && key === 'classify' ? aggregate : empty);
      return {
        key,
        label: TASK_TYPE_LABELS[key] ?? key,
        ...summary,
      };
    });
  }, [status]);

  return (
    <Space direction="vertical" size="large" className="full-width">
      {typeRows.map((row) => {
        const templateKey = isTemplateKey(row.key) ? row.key : null;
        const templateMeta = templateKey ? TEMPLATE_META[templateKey] : null;
        const taskType = isAiTaskType(row.key) ? row.key : null;
        const schedulerState = status.scheduler?.byType?.[row.key]?.state;
        const schedulerRunning = schedulerState === 'running';
        const typeConcurrency = taskType ? concurrency[taskType] : 1;
        const processing = status.scheduler?.byType?.[row.key]?.processing ?? row.processing;
        const percent =
          row.total > 0 ? Math.round(((row.completed + row.skipped) / row.total) * 100) : 0;
        const progressStatus =
          row.failed > 0 ? 'exception' : schedulerRunning ? 'active' : 'normal';

        return (
          <Card
            key={row.key}
            className="options-card"
            title={row.label}
            loading={loading}
            extra={
              templateKey ? (
                <Button size="small" onClick={() => onTemplateReset(templateKey)}>
                  恢复默认
                </Button>
              ) : undefined
            }
          >
            {taskType && (
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={8}>
                  <Space direction="vertical" size={4}>
                    <Text strong>处理状态</Text>
                    <Space>
                      <Switch
                        checked={schedulerRunning}
                        loading={busy[`${taskType}:start`] || busy[`${taskType}:pause`]}
                        checkedChildren="运行中"
                        unCheckedChildren="已暂停"
                        aria-label={`${row.label}运行开关`}
                        onChange={(checked) => {
                          if (checked) {
                            void onStart(taskType);
                          } else {
                            void onPause(taskType);
                          }
                        }}
                      />
                      <Tag color={schedulerRunning ? 'processing' : 'default'}>
                        {schedulerRunning ? '运行中' : '已暂停'}
                      </Tag>
                    </Space>
                    <Text type="secondary">暂停时仍可入队，但不会消费该类型的任务。</Text>
                  </Space>
                </Col>

                <Col xs={24} md={8}>
                  <Space direction="vertical" size={4}>
                    <Text strong>最大并发数</Text>
                    <InputNumber
                      min={1}
                      max={8}
                      value={typeConcurrency}
                      aria-label={`${row.label}最大并发数`}
                      onChange={(value) => {
                        if (typeof value === 'number') onConcurrencyChange(taskType, value);
                      }}
                    />
                  </Space>
                </Col>

                <Col xs={24} md={8}>
                  <Statistic
                    title="当前处理中"
                    value={processing}
                    suffix={`/ ${status.scheduler?.byType?.[row.key]?.concurrency ?? typeConcurrency}`}
                  />
                </Col>
              </Row>
            )}

            <Space
              style={{
                justifyContent: 'space-between',
                width: '100%',
                marginTop: taskType ? 16 : 0,
              }}
            >
              <Text strong>队列进度</Text>
              <Text
                type="secondary"
                title={`待处理 ${row.pending} · 处理中 ${row.processing} · 已完成 ${row.completed} · 跳过 ${row.skipped} · 失败 ${row.failed}`}
              >
                {row.pending} 待处理 · {row.processing} 处理中 · {row.completed}/{row.total} 完成
                {row.skipped > 0 ? ` · ${row.skipped} 跳过` : ''}
                {row.failed > 0 ? ` · ${row.failed} 失败` : ''}
              </Text>
            </Space>
            <Progress
              percent={percent}
              status={progressStatus}
              strokeColor={row.failed > 0 ? undefined : schedulerRunning ? '#52c41a' : '#faad14'}
            />

            {taskType && (
              <Space wrap style={{ marginTop: 16 }}>
                <Button
                  loading={busy[`${taskType}:retry`]}
                  disabled={row.failed === 0}
                  onClick={() => void onRetryFailed(taskType)}
                >
                  重试失败任务
                </Button>
                <Popconfirm
                  title={`清空 ${row.label} 队列`}
                  description="这会删除该类型当前队列记录，确定继续吗？"
                  okText="清空"
                  cancelText="取消"
                  onConfirm={() => void onClearQueue(taskType)}
                >
                  <Button danger loading={busy[`${taskType}:clear`]}>
                    清空本类队列
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title={`全量重扫 ${row.label}`}
                  description="重新扫描全部媒体的该任务类型，确定继续吗？"
                  okText="重扫"
                  cancelText="取消"
                  onConfirm={() => void onRescan(taskType)}
                >
                  <Button loading={busy[`${taskType}:rescan`]}>全量重扫</Button>
                </Popconfirm>
              </Space>
            )}

            {templateKey && templateMeta && (
              <>
                <Divider style={{ margin: '18px 0 12px' }} />
                <Text strong>提示词模板</Text>
                <div style={{ marginTop: 8 }}>
                  <TextArea
                    rows={5}
                    value={templateDrafts[templateKey]}
                    onChange={(event) => onTemplateChange(templateKey, event.target.value)}
                    onBlur={() => onTemplateSave(templateKey)}
                    placeholder={templateMeta.placeholder}
                  />
                </div>
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {templateMeta.description} 留空时使用内置默认模板。
                  </Text>
                </div>
              </>
            )}
          </Card>
        );
      })}
    </Space>
  );
});

export default TaskConsole;
