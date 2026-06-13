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
import type { ExtensionConfig, FilenameStyle, TagDefinition } from '../../shared/extension-runtime';
import { useOptionsData } from './hooks/useOptionsData';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
];

const FILENAME_STYLE_OPTIONS: Array<{ value: FilenameStyle; label: string; description: string }> = [
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
  { id: 'system:uncategorized', name: 'uncategorized', label: '未分类', isSystem: true, sortOrder: 999 },
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
  } = useOptionsData();

  const [endpointDraft, setEndpointDraft] = useState(config.ollamaEndpoint);
  const [stylePromptDraft, setStylePromptDraft] = useState(config.filenameStylePrompt ?? '');
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [isBatchImportVisible, setIsBatchImportVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<TagDefinition | null>(null);
  const [batchImportText, setBatchImportText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [tagForm] = Form.useForm();
  const [batchForm] = Form.useForm();

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

  const saveSetting = async (updates: Partial<ExtensionConfig>, key: string, successText: string) => {
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

  // 标签管理功能
  const openAddTagModal = () => {
    setEditingTag(null);
    tagForm.resetFields();
    setIsTagModalVisible(true);
  };

  const openEditTagModal = (tag: TagDefinition) => {
    setEditingTag(tag);
    tagForm.setFieldsValue({
      name: tag.name,
      label: tag.label,
    });
    setIsTagModalVisible(true);
  };

  const handleTagModalOk = async () => {
    try {
      const values = await tagForm.validateFields();
      let nextTags = [...config.userDefinedTags];

      if (editingTag) {
        // 编辑现有标签
        nextTags = nextTags.map((tag) => {
          if (tag.id === editingTag.id) {
            return { ...tag, name: values.name, label: values.label };
          }
          return tag;
        });
      } else {
        // 添加新标签
        const newTag: TagDefinition = {
          id: `user:${Date.now()}`,
          name: values.name,
          label: values.label,
          isSystem: false,
          sortOrder: nextTags.length + 1,
        };
        nextTags = [...nextTags, newTag];
      }

      await saveSetting({ userDefinedTags: nextTags }, 'tags', editingTag ? '标签已更新' : '标签已添加');
      setIsTagModalVisible(false);
    } catch (formError) {
      console.error('标签表单验证失败:', formError);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    const nextTags = config.userDefinedTags.filter((tag) => tag.id !== tagId);
    await saveSetting({ userDefinedTags: nextTags }, 'tags', '标签已删除');
  };

  const handleMoveTag = async (tagId: string, direction: 'up' | 'down') => {
    const currentIndex = config.userDefinedTags.findIndex((tag) => tag.id === tagId);
    if (currentIndex === -1) return;

    const nextTags = [...config.userDefinedTags];
    if (direction === 'up' && currentIndex > 0) {
      const temp = nextTags[currentIndex];
      nextTags[currentIndex] = nextTags[currentIndex - 1];
      nextTags[currentIndex - 1] = temp;
    } else if (direction === 'down' && currentIndex < nextTags.length - 1) {
      const temp = nextTags[currentIndex];
      nextTags[currentIndex] = nextTags[currentIndex + 1];
      nextTags[currentIndex + 1] = temp;
    }

    // 更新 sortOrder
    const sortedTags = nextTags.map((tag, index) => ({ ...tag, sortOrder: index + 1 }));
    await saveSetting({ userDefinedTags: sortedTags }, 'tags', '标签顺序已更新');
  };

  // 批量导入功能
  const openBatchImportModal = () => {
    setBatchImportText('');
    batchForm.resetFields();
    setIsBatchImportVisible(true);
  };

  const handleBatchImportOk = async () => {
    try {
      const values = await batchForm.validateFields();
      const text = values.tags.trim();

      if (!text) {
        messageApi.warning('请输入标签内容');
        return;
      }

      // 解析标签
      const lines = text.split('\n').filter(line => line.trim());
      const newTags: TagDefinition[] = [];
      const currentMaxOrder = config.userDefinedTags.length;

      lines.forEach((line, index) => {
        const parts = line.split(',');
        const name = parts[0]?.trim().toLowerCase().replace(/\s+/g, '_');
        const label = parts[1]?.trim() || parts[0]?.trim();

        if (name && label) {
          newTags.push({
            id: `user:${Date.now()}-${index}`,
            name,
            label,
            isSystem: false,
            sortOrder: currentMaxOrder + index + 1,
          });
        }
      });

      if (newTags.length === 0) {
        messageApi.warning('没有解析到有效标签');
        return;
      }

      const nextTags = [...config.userDefinedTags, ...newTags];
      await saveSetting({ userDefinedTags: nextTags }, 'tags', `成功导入 ${newTags.length} 个标签`);
      setIsBatchImportVisible(false);
    } catch (formError) {
      console.error('批量导入失败:', formError);
    }
  };

  const handleTranslate = async () => {
    if (!serviceStatus.ollamaAvailable) {
      messageApi.error('Ollama 不可用，无法翻译');
      return;
    }

    setIsTranslating(true);
    try {
      const values = batchForm.getFieldsValue();
      const text = values.tags || '';

      if (!text.trim()) {
        messageApi.warning('请先输入标签内容');
        setIsTranslating(false);
        return;
      }

      // 使用 chrome.runtime 发送翻译请求到 background
      const response = await chrome.runtime.sendMessage({
        type: 'translate-tags',
        text,
      });

      if (response && response.translated) {
        batchForm.setFieldsValue({ tags: response.translated });
        messageApi.success('翻译完成');
      } else {
        messageApi.error('翻译失败');
      }
    } catch (error) {
      console.error('翻译失败:', error);
      messageApi.error('翻译失败');
    } finally {
      setIsTranslating(false);
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
              配置本地 VFS、Ollama AI 分类、文件名风格和分类队列。AI 分类默认暂停，捕获的媒体可以先进入待处理队列。
            </Paragraph>
          </div>

          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

          <Spin spinning={loading} tip="加载配置中...">
            <Space direction="vertical" size="large" className="full-width">
              <Card className="options-card" title="服务状态" extra={<Button onClick={refreshAll}>全部刷新</Button>}>
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

              <Card className="options-card" title="Ollama 设置">
                <Form layout="vertical">
                  <Form.Item label="Ollama 地址" extra="修改后失焦或按 Enter 保存，并用于后续健康检查和分类请求。">
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
                    validateStatus={config.visionModel && !configuredModelAvailable ? 'warning' : undefined}
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
                            ? [model.parameterSize, model.quantizationLevel, formatModelSize(model.size)].filter(Boolean).join(' · ')
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
                title="标签管理"
                extra={
                  <Space>
                    <Button onClick={openBatchImportModal}>批量导入</Button>
                    <Button type="primary" onClick={openAddTagModal}>新增标签</Button>
                  </Space>
                }
              >
                <div style={{ marginBottom: 16 }}>
                  <Title level={5} style={{ marginBottom: 8 }}>系统标签（只读）</Title>
                  <Space wrap>
                    {SYSTEM_TAGS.map((tag) => (
                      <Tag key={tag.id} color="blue">
                        {tag.label}
                      </Tag>
                    ))}
                  </Space>
                </div>

                <div>
                  <Title level={5} style={{ marginBottom: 8 }}>用户定义标签</Title>
                  {config.userDefinedTags.length === 0 ? (
                    <Text type="secondary">暂无用户定义标签，点击"新增标签"添加，或使用"批量导入"一次导入多个标签。</Text>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {config.userDefinedTags.map((tag, index) => (
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
                            <Tag color="cyan">{tag.label}</Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              ({tag.name})
                            </Text>
                          </div>
                          <Space>
                            <Button
                              type="text"
                              size="small"
                              disabled={index === 0}
                              onClick={() => handleMoveTag(tag.id, 'up')}
                            >
                              ↑
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              disabled={index === config.userDefinedTags.length - 1}
                              onClick={() => handleMoveTag(tag.id, 'down')}
                            >
                              ↓
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              onClick={() => openEditTagModal(tag)}
                            >
                              编辑
                            </Button>
                            <Popconfirm
                              title="删除标签"
                              description="确定要删除这个标签吗？这不会影响已分类文件的标签。"
                              okText="删除"
                              cancelText="取消"
                              onConfirm={() => handleDeleteTag(tag.id)}
                            >
                              <Button type="text" danger size="small">
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
                              saveSetting({ classificationConcurrency: value }, 'classificationConcurrency', '并发数已保存');
                            }
                          }}
                        />
                      </Form.Item>
                    </Form>
                  </Col>
                  <Col xs={24} md={8}>
                    <Statistic title="当前处理中" value={queueStatus.scheduler?.processing ?? queueStatus.processing} />
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
                      onChange={(filenameStyle) => saveSetting({ filenameStyle }, 'filenameStyle', '文件名风格已保存')}
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
                  <Col xs={12} md={6}><Statistic title="等待" value={queueStatus.pending} /></Col>
                  <Col xs={12} md={6}><Statistic title="处理中" value={queueStatus.processing} /></Col>
                  <Col xs={12} md={6}><Statistic title="完成" value={queueStatus.completed} /></Col>
                  <Col xs={12} md={6}><Statistic title="失败" value={queueStatus.failed} /></Col>
                </Row>
                <Space style={{ marginTop: 16 }}>
                  <Button loading={saving.retryFailed} disabled={queueStatus.failed === 0} onClick={handleRetryFailed}>
                    重试失败任务
                  </Button>
                  <Popconfirm
                    title="清空分类队列"
                    description="这会删除当前队列记录，确定继续吗？"
                    okText="清空"
                    cancelText="取消"
                    onConfirm={handleClearQueue}
                  >
                    <Button danger loading={saving.clearQueue}>清空队列</Button>
                  </Popconfirm>
                </Space>
              </Card>
            </Space>
          </Spin>
        </Content>
      </Layout>

      <Modal
        title={editingTag ? "编辑标签" : "新增标签"}
        open={isTagModalVisible}
        onOk={handleTagModalOk}
        onCancel={() => setIsTagModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={tagForm} layout="vertical">
          <Form.Item
            name="name"
            label="标签英文名称"
            rules={[{ required: true, message: "请输入标签英文名称" }]}
            extra="用于 AI 分类时的标签识别，使用英文或拼音，不要有空格"
          >
            <Input placeholder="例如：cat, game, screenshot" />
          </Form.Item>
          <Form.Item
            name="label"
            label="显示名称"
            rules={[{ required: true, message: "请输入显示名称" }]}
            extra="在界面上显示的标签名称，可以使用 emoji 和中文"
          >
            <Input placeholder="例如：🐱 猫咪, 🎮 游戏, 📸 截图" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入标签"
        open={isBatchImportVisible}
        onOk={handleBatchImportOk}
        onCancel={() => setIsBatchImportVisible(false)}
        okText="导入"
        cancelText="取消"
        width={600}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item
            name="tags"
            label="标签列表"
            extra="每行一个标签。格式：英文名称, 显示名称（可选）。如果只提供一个值，会同时作为名称和显示名称。"
          >
            <TextArea
              rows={10}
              placeholder={`cat, 🐱 猫咪
game, 🎮 游戏
screenshot, 📸 截图
work
memo`}
            />
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16 }}>
          <Button
            type="default"
            loading={isTranslating}
            onClick={handleTranslate}
            disabled={!serviceStatus.ollamaAvailable}
          >
            使用 Ollama 翻译为中文
          </Button>
          {!serviceStatus.ollamaAvailable && (
            <Text type="secondary" style={{ marginLeft: 8 }}>需要 Ollama 可用才能翻译</Text>
          )}
        </div>
      </Modal>
    </ConfigProvider>
  );
}

export default App;
