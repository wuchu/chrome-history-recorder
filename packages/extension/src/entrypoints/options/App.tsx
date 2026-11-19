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
  Statistic,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type {
  ExtensionConfig,
  FilenameStyle,
  TagDefinition,
  VFSTagRecord,
} from '../../shared/extension-runtime';
import { useOptionsData } from './hooks/useOptionsData';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
];

const FILENAME_STYLE_OPTIONS: Array<{ value: FilenameStyle; label: string; description: string }> =
  [
    { value: 'auto', label: '自动', description: '根据图片内容自动选择风格' },
    { value: 'fun', label: '有趣', description: '活泼、俏皮、像在讲故事' },
    { value: 'sexy', label: '迷人', description: '优雅、有吸引力、有美感' },
    { value: 'artistic', label: '艺术', description: '像描述摄影或画作' },
    { value: 'poetic', label: '诗意', description: '带有意境和情感' },
    { value: 'minimal', label: '极简', description: '只保留核心信息' },
    { value: 'professional', label: '专业', description: '客观、准确、简洁' },
    { value: 'narrative', label: '叙事', description: '描述场景中的情节' },
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
    queueStatus,
    serviceStatus,
    ollamaModels,
    loading,
    saving,
    error,
    refreshAll,
    refreshQueue,
    refreshOllamaModels,
    refreshOllamaHealth,
    reconnectVfsService,
    saveConfig,
    startClassification,
    pauseClassification,
    retryFailedTasks: retryFailed,
    clearQueue,
    syncMediaIndex,
    clearMediaIndex,
    tags,
    refreshTags,
    renameTag,
    mergeTags,
    deleteTag,
    setTagPinned,
  } = useOptionsData();

  const [endpointDraft, setEndpointDraft] = useState(config.ollamaEndpoint);
  const [stylePromptDraft, setStylePromptDraft] = useState(config.filenameStylePrompt ?? '');
  const [renamingTag, setRenamingTag] = useState<VFSTagRecord | null>(null);
  const [mergingTag, setMergingTag] = useState<VFSTagRecord | null>(null);
  const [tagForm] = Form.useForm();
  const [mergeForm] = Form.useForm();

  useEffect(() => {
    setEndpointDraft(config.ollamaEndpoint);
  }, [config.ollamaEndpoint]);

  useEffect(() => {
    setStylePromptDraft(config.filenameStylePrompt ?? '');
  }, [config.filenameStylePrompt]);

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

  const handleStylePromptSave = async () => {
    const nextPrompt = stylePromptDraft.trim();
    if ((config.filenameStylePrompt ?? '') === nextPrompt) return;
    await saveSetting(
      { filenameStylePrompt: nextPrompt || undefined },
      'filenameStyle',
      '自定义风格提示已保存'
    );
  };

  const handleClassificationToggle = async (running: boolean) => {
    if (running) {
      await startClassification();
      messageApi.success('AI 分类已开始');
    } else {
      await pauseClassification();
      messageApi.success('AI 分类已暂停');
    }
  };

  const handleRetryFailed = async () => {
    await retryFailed();
    messageApi.success('失败任务已重新入队');
  };

  const handleClearQueue = async () => {
    await clearQueue();
    messageApi.success('队列已清空');
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
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 10,
        },
      }}
    >
      {contextHolder}
      <Layout className="options-shell">
        <Content className="options-content">
          <div className="options-header">
            <Title level={2}>Media Recorder 设置</Title>
            <Paragraph className="options-subtitle">
              配置本地 VFS、Ollama AI 分类、文件名风格和分类队列。AI
              分类默认暂停，捕获的媒体可以先进入待处理队列。
            </Paragraph>
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

              <Card className="options-card" title="AI 分类控制">
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={8}>
                    <Space direction="vertical">
                      <Text strong>分类处理状态</Text>
                      <Space>
                        <Switch
                          checked={!config.classificationPaused}
                          loading={saving.classificationState}
                          checkedChildren="运行中"
                          unCheckedChildren="已暂停"
                          onChange={handleClassificationToggle}
                        />
                        <Tag color={config.classificationPaused ? 'default' : 'processing'}>
                          {config.classificationPaused ? '已暂停' : '运行中'}
                        </Tag>
                      </Space>
                      <Text type="secondary">默认暂停；暂停时可入队，但不会自动消费任务。</Text>
                    </Space>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form layout="vertical">
                      <Form.Item label="并发数">
                        <InputNumber
                          min={1}
                          max={8}
                          value={config.classificationConcurrency}
                          onChange={(value) => {
                            if (typeof value === 'number') {
                              saveSetting(
                                { classificationConcurrency: value },
                                'classificationConcurrency',
                                '并发数已保存'
                              );
                            }
                          }}
                        />
                      </Form.Item>
                    </Form>
                  </Col>
                  <Col xs={24} md={8}>
                    <Statistic
                      title="当前处理中"
                      value={queueStatus.scheduler?.processing ?? queueStatus.processing}
                    />
                  </Col>
                </Row>
              </Card>

              <Card className="options-card" title="文件名风格">
                <Form layout="vertical">
                  <Form.Item label="风格">
                    <Select
                      value={config.filenameStyle}
                      options={FILENAME_STYLE_OPTIONS.map((style) => ({
                        value: style.value,
                        label: `${style.label} - ${style.description}`,
                      }))}
                      onChange={(filenameStyle) =>
                        saveSetting({ filenameStyle }, 'filenameStyle', '文件名风格已保存')
                      }
                    />
                  </Form.Item>
                  <Form.Item label="自定义提示" extra="留空时使用所选风格的默认提示。失焦后保存。">
                    <TextArea
                      rows={3}
                      value={stylePromptDraft}
                      onChange={(event) => setStylePromptDraft(event.target.value)}
                      onBlur={handleStylePromptSave}
                      placeholder="例如：用简洁、富有画面感的中文短句命名。"
                    />
                  </Form.Item>
                </Form>
              </Card>

              <Card
                className="options-card"
                title="分类队列"
                extra={<Button onClick={refreshQueue}>刷新队列</Button>}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={12} md={6}>
                    <Statistic title="等待" value={queueStatus.pending} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="处理中" value={queueStatus.processing} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="完成" value={queueStatus.completed} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="失败" value={queueStatus.failed} />
                  </Col>
                </Row>
                <Space style={{ marginTop: 16 }}>
                  <Button
                    loading={saving.retryFailed}
                    disabled={queueStatus.failed === 0}
                    onClick={handleRetryFailed}
                  >
                    重试失败任务
                  </Button>
                  <Popconfirm
                    title="清空分类队列"
                    description="这会删除当前队列记录，确定继续吗？"
                    okText="清空"
                    cancelText="取消"
                    onConfirm={handleClearQueue}
                  >
                    <Button danger loading={saving.clearQueue}>
                      清空队列
                    </Button>
                  </Popconfirm>
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
