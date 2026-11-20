import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Layout,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  theme,
  Typography,
} from 'antd';
import {
  DEFAULT_MAX_VIDEO_SIZE,
  MAX_VIDEO_SIZE_LIMIT,
  MIN_VIDEO_SIZE_LIMIT,
  SUPPORTED_VIDEO_MIME_TYPES,
  type ExtensionConfig,
  type TagDefinition,
  type VFSTagRecord,
} from '../../shared/extension-runtime';
import { DEFAULT_PROMPT_TEMPLATES, type PromptTemplates } from '../../shared/prompt-templates';
import { useOptionsData } from './hooks/useOptionsData';
import { useTaskQueue } from './hooks/useTaskQueue';
import TaskConsole from './components/TaskConsole';
import { useTheme } from '../media-browser/hooks/useTheme';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
];

const VIDEO_TYPE_OPTIONS = SUPPORTED_VIDEO_MIME_TYPES.map((type) => ({
  value: type,
  label: type,
}));

const MIN_VIDEO_SIZE_MB = MIN_VIDEO_SIZE_LIMIT / (1024 * 1024);
const MAX_VIDEO_SIZE_MB = MAX_VIDEO_SIZE_LIMIT / (1024 * 1024);
const DEFAULT_MAX_VIDEO_SIZE_MB = DEFAULT_MAX_VIDEO_SIZE / (1024 * 1024);

const PROMPT_TEMPLATE_FIELDS: Array<{
  key: keyof PromptTemplates;
  label: string;
  placeholder: string;
  help: string;
}> = [
  {
    key: 'classify',
    label: '标签分类（classify）',
    placeholder: '{{vocabulary}}',
    help: '生成图片标签。占位符 {{vocabulary}} 会被替换为现有标签词表。',
  },
  {
    key: 'rename',
    label: '文件重命名（rename）',
    placeholder: '观察这张图片，为它生成一个简洁生动的文件名…',
    help: '生成文件名。命名风格直接写在本模板中，无需额外占位符。',
  },
  {
    key: 'translate',
    label: '标签翻译（translate）',
    placeholder: '{{input}}',
    help: '翻译标签。占位符 {{input}} 会被替换为待翻译文本。',
  },
];

// 系统标签定义
const SYSTEM_TAGS: TagDefinition[] = [
  { id: 'system:image', name: 'image', label: '📷 图片', isSystem: true, sortOrder: 1 },
  { id: 'system:video', name: 'video', label: '🎬 视频', isSystem: true, sortOrder: 2 },
  { id: 'system:starred', name: 'starred', label: '⭐ 已收藏', isSystem: true, sortOrder: 100 },
  {
    id: 'system:uncategorized',
    name: 'uncategorized',
    label: '未分类',
    isSystem: true,
    sortOrder: 999,
  },
];

function formatModelSize(size?: number): string | undefined {
  if (!size) return undefined;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(0)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const {
    config,
    serviceStatus,
    ollamaModels,
    loading,
    saving,
    error,
    refreshAll,
    refreshOllamaModels,
    refreshOllamaHealth,
    reconnectVfsService,
    saveConfig,
    syncMediaIndex,
    clearMediaIndex,
    tags,
    refreshTags,
    renameTag,
    mergeTags,
    deleteTag,
    setTagPinned,
    savePromptTemplate,
    resetPromptTemplate,
  } = useOptionsData();

  const taskQueue = useTaskQueue();
  const { themeMode, systemDark, changeTheme } = useTheme();
  const isDark = useMemo(
    () => (themeMode === 'auto' ? systemDark : themeMode === 'dark'),
    [themeMode, systemDark]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  const [endpointDraft, setEndpointDraft] = useState(config.ollamaEndpoint);
  const [templateDrafts, setTemplateDrafts] = useState<Record<keyof PromptTemplates, string>>(
    () => ({
      classify: config.promptTemplates?.classify ?? DEFAULT_PROMPT_TEMPLATES.classify,
      rename: config.promptTemplates?.rename ?? DEFAULT_PROMPT_TEMPLATES.rename,
      translate: config.promptTemplates?.translate ?? DEFAULT_PROMPT_TEMPLATES.translate,
    })
  );
  const [maxVideoSizeMb, setMaxVideoSizeMb] = useState<number>(DEFAULT_MAX_VIDEO_SIZE_MB);
  const [renamingTag, setRenamingTag] = useState<VFSTagRecord | null>(null);
  const [mergingTag, setMergingTag] = useState<VFSTagRecord | null>(null);
  const [tagForm] = Form.useForm();
  const [mergeForm] = Form.useForm();

  useEffect(() => {
    setEndpointDraft(config.ollamaEndpoint);
  }, [config.ollamaEndpoint]);

  useEffect(() => {
    setMaxVideoSizeMb(Math.round(config.maxVideoSize / (1024 * 1024)));
  }, [config.maxVideoSize]);

  useEffect(() => {
    setTemplateDrafts({
      classify: config.promptTemplates?.classify ?? DEFAULT_PROMPT_TEMPLATES.classify,
      rename: config.promptTemplates?.rename ?? DEFAULT_PROMPT_TEMPLATES.rename,
      translate: config.promptTemplates?.translate ?? DEFAULT_PROMPT_TEMPLATES.translate,
    });
  }, [config.promptTemplates]);

  useEffect(() => {
    if (error) {
      messageApi.error(error);
    }
  }, [error, messageApi]);

  const configuredModelAvailable = useMemo(() => {
    if (ollamaModels.length === 0) return true;
    if (!config.visionModel) return false;
    return ollamaModels.some((model) => model.name === config.visionModel);
  }, [config.visionModel, ollamaModels]);

  const saveSetting = async (
    updates: Partial<ExtensionConfig>,
    key: string,
    successText: string
  ) => {
    await saveConfig(updates, key);
    messageApi.success(successText);
  };

  const handleEndpointSave = async () => {
    const nextEndpoint = endpointDraft.trim();
    if (!nextEndpoint || nextEndpoint === config.ollamaEndpoint) return;
    await saveSetting({ ollamaEndpoint: nextEndpoint }, 'ollamaEndpoint', 'Ollama 地址已保存');
    await refreshOllamaHealth();
  };

  const handleRefreshModels = async () => {
    try {
      await refreshOllamaModels();
      messageApi.success('模型列表已刷新');
    } catch (refreshError) {
      const text = refreshError instanceof Error ? refreshError.message : '刷新模型失败';
      messageApi.error(text);
    }
  };

  const handleModelChange = async (visionModel: string) => {
    await saveSetting({ visionModel }, 'visionModel', `模型已切换为 ${visionModel}`);
  };

  const handleTemplateSave = async (key: keyof PromptTemplates) => {
    const value = templateDrafts[key].trim();
    const current = (config.promptTemplates?.[key] ?? DEFAULT_PROMPT_TEMPLATES[key]).trim();
    if (current === value) return;
    await savePromptTemplate(key, value || undefined);
    messageApi.success('提示词模板已保存');
  };

  const handleTemplateReset = async (key: keyof PromptTemplates) => {
    await resetPromptTemplate(key);
    messageApi.success('已恢复默认提示词');
  };

  const handleStart = async () => {
    await taskQueue.start();
    messageApi.success('AI 任务已开始');
  };

  const handlePause = async () => {
    await taskQueue.pause();
    messageApi.success('AI 任务已暂停');
  };

  const handleRetryFailed = async () => {
    await taskQueue.retryFailed();
    messageApi.success('失败任务已重新入队');
  };

  const handleClearQueue = async () => {
    await taskQueue.clearQueue();
    messageApi.success('队列已清空');
  };

  const handleRescan = async () => {
    const count = await taskQueue.requeueAll(['classify', 'rename']);
    messageApi.success(`已重新入队 ${count} 个任务`);
  };

  const handleConcurrencyChange = (value: number) => {
    void saveSetting(
      { classificationConcurrency: value },
      'classificationConcurrency',
      '并发数已保存'
    );
  };

  const handleVideoCaptureToggle = async (checked: boolean) => {
    await saveSetting(
      { captureVideos: checked },
      'videoCapture',
      checked ? '已开启视频捕获' : '已关闭视频捕获'
    );
  };

  const handleMaxVideoSizeSave = async () => {
    const value = Math.floor(maxVideoSizeMb);
    if (!Number.isFinite(value) || value < MIN_VIDEO_SIZE_MB || value > MAX_VIDEO_SIZE_MB) {
      messageApi.error(`视频大小上限需在 ${MIN_VIDEO_SIZE_MB}–${MAX_VIDEO_SIZE_MB} MB 之间`);
      setMaxVideoSizeMb(Math.round(config.maxVideoSize / (1024 * 1024)));
      return;
    }

    if (value * 1024 * 1024 === config.maxVideoSize) return;
    await saveSetting({ maxVideoSize: value * 1024 * 1024 }, 'videoCapture', '视频大小上限已保存');
  };

  const handleVideoFormatsChange = async (types: string[]) => {
    if (types.length === 0) {
      messageApi.warning('至少保留一种视频格式');
      return;
    }
    await saveSetting({ enabledVideoTypes: types }, 'videoCapture', '视频格式已保存');
  };

  const handleSyncMediaIndex = async () => {
    try {
      const result = await syncMediaIndex();
      const errorText = result.errors.length > 0 ? `，错误 ${result.errors.length} 个` : '';
      messageApi.success(
        `同步完成：新增 ${result.indexed} 个，跳过已存在 ${result.skippedExisting} 个${errorText}`
      );
    } catch (syncError) {
      const text = syncError instanceof Error ? syncError.message : '同步媒体索引失败';
      messageApi.error(text);
    }
  };

  const handleClearIndex = async () => {
    try {
      await clearMediaIndex();
      messageApi.success('索引已清空，可以点击"同步原始媒体到索引"重新建立索引');
    } catch (clearError) {
      const text = clearError instanceof Error ? clearError.message : '清空索引失败';
      messageApi.error(text);
    }
  };

  // AI 标签治理：重命名 / 合并 / 删除 / 置顶
  const openRenameTagModal = (tag: VFSTagRecord) => {
    setRenamingTag(tag);
    tagForm.setFieldsValue({ name: tag.name, label: tag.label ?? '' });
  };

  const handleRenameTagOk = async () => {
    if (!renamingTag) return;
    try {
      const values = await tagForm.validateFields();
      await renameTag(renamingTag.id, values.name.trim(), values.label?.trim() || undefined);
      messageApi.success('标签已重命名');
      setRenamingTag(null);
    } catch (formError) {
      console.error('标签重命名失败:', formError);
    }
  };

  const openMergeTagModal = (tag: VFSTagRecord) => {
    setMergingTag(tag);
    mergeForm.resetFields();
  };

  const handleMergeTagOk = async () => {
    if (!mergingTag) return;
    try {
      const values = await mergeForm.validateFields();
      if (values.targetId === mergingTag.id) {
        messageApi.warning('请选择不同的目标标签');
        return;
      }
      await mergeTags(mergingTag.id, values.targetId);
      messageApi.success('标签已合并');
      setMergingTag(null);
    } catch (formError) {
      console.error('标签合并失败:', formError);
    }
  };

  const handleDeleteTag = async (tag: VFSTagRecord) => {
    try {
      await deleteTag(tag.id);
      messageApi.success('标签已删除');
    } catch (deleteError) {
      const text = deleteError instanceof Error ? deleteError.message : '删除标签失败';
      messageApi.error(text);
    }
  };

  const handleTogglePinned = async (tag: VFSTagRecord, pinned: boolean) => {
    try {
      await setTagPinned(tag.id, pinned);
    } catch (pinError) {
      const text = pinError instanceof Error ? pinError.message : '置顶标签失败';
      messageApi.error(text);
    }
  };

  const handleRefreshTags = async () => {
    try {
      await refreshTags();
      messageApi.success('标签词表已刷新');
    } catch (refreshError) {
      const text = refreshError instanceof Error ? refreshError.message : '刷新标签失败';
      messageApi.error(text);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 10,
        },
      }}
    >
      {contextHolder}
      <Layout className="options-shell" data-theme={isDark ? 'dark' : 'light'}>
        <Content className="options-content">
          <div className="options-header">
            <div>
              <Title level={2}>Media Recorder 设置</Title>
              <Paragraph className="options-subtitle">
                配置本地 VFS、Ollama AI 分类、文件名风格和分类队列。AI
                分类默认暂停，捕获的媒体可以先进入待处理队列。
              </Paragraph>
            </div>
            <Select
              value={themeMode}
              onChange={(value) => changeTheme(value as 'auto' | 'light' | 'dark')}
              style={{ width: 140 }}
              options={[
                { value: 'auto', label: '主题：自动' },
                { value: 'light', label: '主题：亮色' },
                { value: 'dark', label: '主题：暗色' },
              ]}
            />
          </div>

          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

          <Spin spinning={loading} tip="加载配置中...">
            <Space direction="vertical" size="large" className="full-width">
              <Card
                className="options-card"
                title="服务状态"
                extra={<Button onClick={refreshAll}>全部刷新</Button>}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <div className="status-row">
                      <Space direction="vertical" size={2}>
                        <Text strong>VFS WebSocket</Text>
                        <Badge
                          status={serviceStatus.vfsConnected ? 'success' : 'error'}
                          text={serviceStatus.vfsConnected ? '已连接' : '未连接'}
                        />
                      </Space>
                      <Button loading={saving.vfsReconnect} onClick={reconnectVfsService}>
                        重连 VFS
                      </Button>
                    </div>
                  </Col>
                  <Col xs={24} md={12}>
                    <div className="status-row">
                      <Space direction="vertical" size={2}>
                        <Text strong>Ollama</Text>
                        <Badge
                          status={serviceStatus.ollamaAvailable ? 'success' : 'error'}
                          text={serviceStatus.ollamaAvailable ? '可用' : '不可用'}
                        />
                      </Space>
                      <Button loading={saving.ollamaHealth} onClick={refreshOllamaHealth}>
                        检查 Ollama
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Card>

              <Card className="options-card" title="媒体索引维护">
                <div className="status-row">
                  <Space direction="vertical" size={2}>
                    <Text strong>原始媒体索引</Text>
                    <Badge
                      status={serviceStatus.vfsConnected ? 'success' : 'error'}
                      text={serviceStatus.vfsConnected ? 'VFS 已连接' : 'VFS 未连接'}
                    />
                  </Space>
                  <Space>
                    <Popconfirm
                      title="清空索引"
                      description="确定要清空所有索引吗？物理文件不会被删除，你可以随后重新同步。"
                      onConfirm={handleClearIndex}
                      okText="清空"
                      cancelText="取消"
                    >
                      <Button
                        danger
                        loading={saving.clearIndex}
                        disabled={!serviceStatus.vfsConnected}
                      >
                        清空索引
                      </Button>
                    </Popconfirm>
                    <Button
                      type="primary"
                      loading={saving.syncBlobsToIndex}
                      disabled={!serviceStatus.vfsConnected}
                      onClick={handleSyncMediaIndex}
                    >
                      同步原始媒体到索引
                    </Button>
                  </Space>
                </div>
              </Card>

              <Card className="options-card" title="视频捕获">
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  捕获直链视频（如 MP4/WebM
                  文件）。开启后，侧边栏中的捕获会话会把识别到的完整视频下载到本地
                  VFS。流媒体分片（MSE/blob）暂不支持。
                </Paragraph>
                <Form layout="vertical">
                  <Form.Item label="启用视频捕获">
                    <Switch
                      checked={config.captureVideos}
                      loading={saving.videoCapture}
                      onChange={handleVideoCaptureToggle}
                      checkedChildren="开启"
                      unCheckedChildren="关闭"
                    />
                  </Form.Item>

                  <Form.Item
                    label="单个视频大小上限"
                    extra={`范围 ${MIN_VIDEO_SIZE_MB}–${MAX_VIDEO_SIZE_MB} MB。超过上限的视频会被跳过。`}
                  >
                    <InputNumber
                      min={MIN_VIDEO_SIZE_MB}
                      max={MAX_VIDEO_SIZE_MB}
                      step={10}
                      value={maxVideoSizeMb}
                      addonAfter="MB"
                      style={{ width: 200 }}
                      onChange={(value) =>
                        setMaxVideoSizeMb(
                          typeof value === 'number' ? value : DEFAULT_MAX_VIDEO_SIZE_MB
                        )
                      }
                      onBlur={handleMaxVideoSizeSave}
                      onPressEnter={handleMaxVideoSizeSave}
                    />
                  </Form.Item>

                  <Form.Item label="捕获格式" extra="仅这些 MIME 类型的视频会被识别为下载候选。">
                    <Select
                      mode="multiple"
                      value={config.enabledVideoTypes}
                      options={VIDEO_TYPE_OPTIONS}
                      loading={saving.videoCapture}
                      onChange={handleVideoFormatsChange}
                      placeholder="选择至少一种视频格式"
                    />
                  </Form.Item>
                </Form>
              </Card>

              <Card className="options-card" title="Ollama 设置">
                <Form layout="vertical">
                  <Form.Item
                    label="Ollama 地址"
                    extra="修改后失焦或按 Enter 保存，并用于后续健康检查和分类请求。"
                  >
                    <Input.Search
                      value={endpointDraft}
                      enterButton="保存"
                      loading={saving.ollamaEndpoint}
                      placeholder="http://localhost:11434"
                      onChange={(event) => setEndpointDraft(event.target.value)}
                      onBlur={handleEndpointSave}
                      onSearch={handleEndpointSave}
                    />
                  </Form.Item>

                  <Form.Item
                    label="视觉模型"
                    validateStatus={
                      config.visionModel && !configuredModelAvailable ? 'warning' : undefined
                    }
                    help={
                      config.visionModel && !configuredModelAvailable
                        ? `当前配置的模型 ${config.visionModel} 不在已发现的 Ollama 模型中`
                        : undefined
                    }
                    extra="选择后立即保存。刷新模型只更新列表，不会覆盖当前选择。"
                  >
                    <Space.Compact className="full-width">
                      <Select
                        className="full-width"
                        showSearch
                        placeholder={!config.visionModel ? '请选择模型' : undefined}
                        value={config.visionModel}
                        loading={saving.visionModel}
                        onChange={handleModelChange}
                        optionFilterProp="label"
                        options={[
                          ...(config.visionModel && !configuredModelAvailable
                            ? [{ value: config.visionModel, label: config.visionModel }]
                            : []),
                          ...ollamaModels.map((model) => ({
                            value: model.name,
                            label: model.name,
                            title: model.name,
                          })),
                        ]}
                        optionRender={(option) => {
                          const model = ollamaModels.find((item) => item.name === option.value);
                          const detail = model
                            ? [
                                model.parameterSize,
                                model.quantizationLevel,
                                formatModelSize(model.size),
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            : '当前配置值';
                          return (
                            <Space direction="vertical" size={0}>
                              <span>{option.label}</span>
                              {detail && <span className="model-option-meta">{detail}</span>}
                            </Space>
                          );
                        }}
                      />
                      <Button onClick={handleRefreshModels}>刷新模型</Button>
                    </Space.Compact>
                  </Form.Item>

                  <Form.Item label="输出语言">
                    <Select
                      value={config.language}
                      options={LANGUAGE_OPTIONS}
                      onChange={(language) => saveSetting({ language }, 'config', '语言设置已保存')}
                    />
                  </Form.Item>
                </Form>
              </Card>

              <Card
                className="options-card"
                title="AI 标签治理"
                extra={<Button onClick={handleRefreshTags}>刷新标签</Button>}
              >
                <div style={{ marginBottom: 16 }}>
                  <Title level={5} style={{ marginBottom: 8 }}>
                    系统标签（只读）
                  </Title>
                  <Space wrap>
                    {SYSTEM_TAGS.map((tag) => (
                      <Tag key={tag.id} color="blue">
                        {tag.label}
                      </Tag>
                    ))}
                  </Space>
                </div>

                <div>
                  <Title level={5} style={{ marginBottom: 8 }}>
                    AI 标签词表
                  </Title>
                  <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    标签由 AI 分类时自动创建和归并。这里可以修正名称、合并近义标签、删除或置顶。
                  </Paragraph>
                  {tags.length === 0 ? (
                    <Text type="secondary">暂无标签。运行 AI 分类后，标签会自动出现在这里。</Text>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#fafafa',
                            borderRadius: 4,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Tag color={tag.is_pinned ? 'gold' : 'cyan'}>
                              {tag.label || tag.name}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              ({tag.name}) · 使用 {tag.usage_count} 次
                            </Text>
                          </div>
                          <Space>
                            <Button
                              type="text"
                              size="small"
                              disabled={saving.tags}
                              onClick={() => handleTogglePinned(tag, tag.is_pinned !== 1)}
                            >
                              {tag.is_pinned ? '取消置顶' : '置顶'}
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              disabled={saving.tags}
                              onClick={() => openRenameTagModal(tag)}
                            >
                              重命名
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              disabled={saving.tags || tags.length < 2}
                              onClick={() => openMergeTagModal(tag)}
                            >
                              合并
                            </Button>
                            <Popconfirm
                              title="删除标签"
                              description="确定要删除这个标签吗？已分类文件上的同名标签会被移除。"
                              okText="删除"
                              cancelText="取消"
                              onConfirm={() => handleDeleteTag(tag)}
                            >
                              <Button type="text" danger size="small" disabled={saving.tags}>
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        </div>
                      ))}
                    </Space>
                  )}
                </div>
              </Card>

              <TaskConsole
                status={taskQueue.status}
                loading={taskQueue.loading}
                busy={taskQueue.busy}
                concurrency={config.classificationConcurrency}
                onStart={handleStart}
                onPause={handlePause}
                onRetryFailed={handleRetryFailed}
                onClearQueue={handleClearQueue}
                onRescan={handleRescan}
                onConcurrencyChange={handleConcurrencyChange}
              />

              <Card className="options-card" title="AI 提示词模板">
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  自定义发送给 Ollama 的提示词模板，使用 {'{{占位符}}'}{' '}
                  注入动态内容。留空时使用内置默认模板。
                </Paragraph>
                <Space direction="vertical" size="middle" className="full-width">
                  {PROMPT_TEMPLATE_FIELDS.map((field) => (
                    <div key={field.key}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Text strong>{field.label}</Text>
                        <Button size="small" onClick={() => handleTemplateReset(field.key)}>
                          恢复默认
                        </Button>
                      </div>
                      <TextArea
                        rows={4}
                        value={templateDrafts[field.key]}
                        onChange={(event) =>
                          setTemplateDrafts((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        onBlur={() => handleTemplateSave(field.key)}
                        placeholder={field.placeholder}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {field.help}
                      </Text>
                    </div>
                  ))}
                </Space>
              </Card>
            </Space>
          </Spin>
        </Content>
      </Layout>

      <Modal
        title="重命名标签"
        open={renamingTag !== null}
        onOk={handleRenameTagOk}
        onCancel={() => setRenamingTag(null)}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving.tags}
      >
        <Form form={tagForm} layout="vertical">
          <Form.Item
            name="name"
            label="标签名"
            rules={[{ required: true, message: '请输入标签名' }]}
            extra="用于 AI 分类匹配与入库，建议使用小写英文或拼音"
          >
            <Input placeholder="例如：cat, game, screenshot" />
          </Form.Item>
          <Form.Item name="label" label="显示名称">
            <Input placeholder="例如：🐱 猫咪, 🎮 游戏" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={mergingTag ? `合并「${mergingTag.label || mergingTag.name}」` : '合并标签'}
        open={mergingTag !== null}
        onOk={handleMergeTagOk}
        onCancel={() => setMergingTag(null)}
        okText="合并"
        cancelText="取消"
        confirmLoading={saving.tags}
      >
        <Paragraph type="secondary">
          源标签的别名与使用记录会合并到目标标签，源标签随后删除。
        </Paragraph>
        <Form form={mergeForm} layout="vertical">
          <Form.Item
            name="targetId"
            label="合并到"
            rules={[{ required: true, message: '请选择目标标签' }]}
          >
            <Select
              placeholder="选择目标标签"
              showSearch
              optionFilterProp="label"
              options={tags
                .filter((tag) => tag.id !== mergingTag?.id)
                .map((tag) => ({
                  value: tag.id,
                  label: `${tag.label || tag.name} (${tag.name})`,
                }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}

export default App;
