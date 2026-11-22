import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  ConfigProvider,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
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
  Tooltip,
  Typography,
  type MenuProps,
} from 'antd';
import {
  DashboardOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  SettingOutlined,
  TagsOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  DEFAULT_MAX_VIDEO_SIZE,
  MAX_VIDEO_SIZE_LIMIT,
  MIN_VIDEO_SIZE_LIMIT,
  SUPPORTED_VIDEO_MIME_TYPES,
  type ExtensionConfig,
  type TagDefinition,
  type VFSTagRecord,
  type VideoCaptureMode,
  type WorkspaceConfigInfo,
} from '../../shared/extension-runtime';
import { DEFAULT_PROMPT_TEMPLATES, type PromptTemplates } from '../../shared/prompt-templates';
import { useOptionsData } from './hooks/useOptionsData';
import { useTaskQueue, type AiTaskType } from './hooks/useTaskQueue';
import TaskConsole from './components/TaskConsole';
import OverviewTab from './components/OverviewTab';
import MediaLibrary from './components/MediaLibrary';
import TrashPage from './components/TrashPage';
import MediaArchiveCard from './components/MediaArchiveCard';
import { consoleTabHash, isConsoleTab, readConsoleTabFromHash, type ConsoleTab } from './tabs';
import { useTheme } from '../media-browser/hooks/useTheme';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const NAV_ITEMS: MenuProps['items'] = [
  { key: 'overview', icon: <DashboardOutlined />, label: '概览' },
  { key: 'library', icon: <PictureOutlined />, label: '媒体库' },
  { key: 'tags', icon: <TagsOutlined />, label: '标签' },
  { key: 'tasks', icon: <ThunderboltOutlined />, label: '任务' },
  { key: 'trash', icon: <DeleteOutlined />, label: '回收站' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' },
];

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
];

const AI_TASK_LABELS: Record<AiTaskType, string> = {
  classify: 'AI 分类',
  rename: 'AI 重命名',
};

const WORKSPACE_SOURCE_LABELS: Record<WorkspaceConfigInfo['source'], string> = {
  cli: '启动参数 (--workspace)',
  env: '环境变量 (VFS_WORKSPACE)',
  config: 'launcher 配置',
  default: '默认值',
};

const VIDEO_TYPE_OPTIONS = SUPPORTED_VIDEO_MIME_TYPES.map((type) => ({
  value: type,
  label: type,
}));

const MIN_VIDEO_SIZE_MB = MIN_VIDEO_SIZE_LIMIT / (1024 * 1024);
const MAX_VIDEO_SIZE_MB = MAX_VIDEO_SIZE_LIMIT / (1024 * 1024);
const DEFAULT_MAX_VIDEO_SIZE_MB = DEFAULT_MAX_VIDEO_SIZE / (1024 * 1024);

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
  const [modal, modalContextHolder] = Modal.useModal();
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
    workspaceInfo,
    workspaceLoading,
    refreshWorkspaceConfig,
    saveWorkspacePath,
    mediaArchiveStatus,
    refreshMediaArchiveStatus,
    saveMediaArchiveConfig,
    runMediaArchive,
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
    })
  );
  const [maxVideoSizeMb, setMaxVideoSizeMb] = useState<number>(DEFAULT_MAX_VIDEO_SIZE_MB);
  const [videoModeHostDraft, setVideoModeHostDraft] = useState('');
  const [ollamaConcurrencyDraft, setOllamaConcurrencyDraft] = useState<number>(
    config.ollamaMaxConcurrency
  );
  const [workspaceDraft, setWorkspaceDraft] = useState('');
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
    setVideoModeHostDraft(
      Object.entries(config.videoCaptureModeByHost ?? {})
        .map(([host, mode]) => `${host}=${mode}`)
        .join('\n')
    );
  }, [config.videoCaptureModeByHost]);

  useEffect(() => {
    setOllamaConcurrencyDraft(config.ollamaMaxConcurrency);
  }, [config.ollamaMaxConcurrency]);

  useEffect(() => {
    setWorkspaceDraft(workspaceInfo?.pendingPath ?? workspaceInfo?.path ?? '');
  }, [workspaceInfo]);

  const workspaceOverride = workspaceInfo?.source === 'cli' || workspaceInfo?.source === 'env';

  useEffect(() => {
    setTemplateDrafts({
      classify: config.promptTemplates?.classify ?? DEFAULT_PROMPT_TEMPLATES.classify,
      rename: config.promptTemplates?.rename ?? DEFAULT_PROMPT_TEMPLATES.rename,
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

  const handleOllamaConcurrencySave = async () => {
    const value = Math.floor(ollamaConcurrencyDraft);
    if (!Number.isFinite(value) || value < 1 || value > 8) {
      messageApi.error('Chat 最大并发数需在 1–8 之间');
      setOllamaConcurrencyDraft(config.ollamaMaxConcurrency);
      return;
    }
    if (value === config.ollamaMaxConcurrency) return;
    await saveSetting({ ollamaMaxConcurrency: value }, 'ollamaMaxConcurrency', 'Chat 并发数已保存');
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

  const handleRefreshWorkspace = async () => {
    try {
      await refreshWorkspaceConfig();
      messageApi.success('工作区信息已刷新');
    } catch (refreshError) {
      const text = refreshError instanceof Error ? refreshError.message : '刷新工作区信息失败';
      messageApi.error(text);
    }
  };

  const handleCopyWorkspacePath = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      messageApi.success('路径已复制');
    } catch {
      messageApi.error('复制失败，请手动选择路径');
    }
  };

  const handleMediaArchiveToggle = async (
    enabled: boolean,
    targetPath: string,
    intervalMinutes: number,
    concurrency: number
  ) => {
    try {
      await saveMediaArchiveConfig({
        enabled,
        targetPath: enabled ? targetPath : (mediaArchiveStatus?.targetPath ?? targetPath),
        intervalMinutes,
        concurrency,
      });
      messageApi.success(enabled ? '媒体归档已启用' : '媒体归档已停用');
    } catch (toggleError) {
      messageApi.error(toggleError instanceof Error ? toggleError.message : '保存归档设置失败');
    }
  };

  const handleMediaArchiveSave = async (
    targetPath: string,
    intervalMinutes: number,
    concurrency: number
  ) => {
    if (!targetPath) {
      messageApi.error('请输入归档目标目录');
      return;
    }

    try {
      await saveMediaArchiveConfig({ targetPath, intervalMinutes, concurrency });
      messageApi.success('媒体归档设置已保存');
    } catch (saveError) {
      messageApi.error(saveError instanceof Error ? saveError.message : '保存归档设置失败');
    }
  };

  const handleMediaArchiveRun = async () => {
    try {
      await runMediaArchive();
      messageApi.success('已触发媒体归档');
    } catch (runError) {
      messageApi.error(runError instanceof Error ? runError.message : '触发归档失败');
    }
  };

  const handleRefreshMediaArchive = async () => {
    try {
      await refreshMediaArchiveStatus();
      messageApi.success('归档状态已刷新');
    } catch (refreshError) {
      messageApi.error(refreshError instanceof Error ? refreshError.message : '刷新归档状态失败');
    }
  };

  const handleWorkspaceSave = () => {
    if (!workspaceInfo) return;
    const nextPath = workspaceDraft.trim();
    if (!nextPath || nextPath === workspaceInfo.path) return;

    modal.confirm({
      title: '更改工作区路径',
      content: (
        <Space direction="vertical" size={6}>
          <Text>保存后需要重启后端进程才会切换工作区。</Text>
          <Text type="secondary">
            如果新目录为空，应用会把它初始化为全新的工作区，Ollama 等配置回到默认值。
          </Text>
          <Text type="secondary">
            当前工作区 {workspaceInfo.path} 的数据和配置会原地保留，不会被移动或删除。
          </Text>
        </Space>
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        try {
          await saveWorkspacePath(nextPath);
          messageApi.success('工作区路径已保存，重启后端后生效');
        } catch (saveError) {
          messageApi.error(saveError instanceof Error ? saveError.message : '保存工作区路径失败');
        }
      },
    });
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

  const handleStart = async (taskType: AiTaskType) => {
    await taskQueue.start(taskType);
    messageApi.success(`${AI_TASK_LABELS[taskType]}已开始`);
  };

  const handlePause = async (taskType: AiTaskType) => {
    await taskQueue.pause(taskType);
    messageApi.success(`${AI_TASK_LABELS[taskType]}已暂停`);
  };

  const handleRetryFailed = async (taskType: AiTaskType) => {
    await taskQueue.retryFailed(taskType);
    messageApi.success(`${AI_TASK_LABELS[taskType]}失败任务已重新入队`);
  };

  const handleClearQueue = async (taskType: AiTaskType) => {
    await taskQueue.clearQueue(taskType);
    messageApi.success(`${AI_TASK_LABELS[taskType]}队列已清空`);
  };

  const handleRescan = async (taskType: AiTaskType) => {
    const count = await taskQueue.requeueAll([taskType]);
    messageApi.success(`已重新入队 ${count} 个${AI_TASK_LABELS[taskType]}任务`);
  };

  const handleTaskConcurrencyChange = (taskType: AiTaskType, value: number) => {
    void saveSetting(
      taskType === 'classify' ? { classifyConcurrency: value } : { renameConcurrency: value },
      taskType === 'classify' ? 'classifyConcurrency' : 'renameConcurrency',
      `${AI_TASK_LABELS[taskType]}并发数已保存`
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

  const handleVideoCaptureModeChange = async (mode: VideoCaptureMode) => {
    await saveSetting({ videoCaptureMode: mode }, 'videoCaptureMode', '视频捕获模式已保存');
  };

  const handleFillGapsToggle = async (checked: boolean) => {
    await saveSetting(
      { videoAssemblyFillGaps: checked },
      'videoAssemblyFillGaps',
      checked ? '已开启缺失区间补齐' : '已关闭缺失区间补齐'
    );
  };

  const handleVideoModeHostSave = async () => {
    const next: Record<string, VideoCaptureMode> = {};
    for (const rawLine of videoModeHostDraft.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const [rawHost, rawMode] = line.split('=').map((part) => part.trim());
      const host = (rawHost ?? '').toLowerCase().replace(/^\*?\./, '');
      if (!host) {
        messageApi.error(`无法解析站点覆盖：${line}`);
        return;
      }
      if (rawMode !== 'buffer-only' && rawMode !== 're-download') {
        messageApi.error(`站点 ${host} 的模式必须是 buffer-only 或 re-download`);
        return;
      }
      next[host] = rawMode;
    }

    await saveSetting({ videoCaptureModeByHost: next }, 'videoCaptureModeByHost', '站点覆盖已保存');
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

  const confirmDeleteTag = (tag: VFSTagRecord) => {
    modal.confirm({
      title: '删除标签',
      content: '确定要删除这个标签吗？已分类文件上的同名标签会被移除。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => handleDeleteTag(tag),
    });
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

  const readTabFromHash = useCallback(
    (): ConsoleTab => readConsoleTabFromHash(window.location.hash),
    []
  );

  const [activeTab, setActiveTab] = useState<ConsoleTab>(() => readTabFromHash());
  const [navCollapsed, setNavCollapsed] = useState(true);

  useEffect(() => {
    const handleHashChange = () => setActiveTab(readTabFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [readTabFromHash]);

  const handleTabChange = (key: string) => {
    const next = isConsoleTab(key) ? key : 'overview';
    setActiveTab(next);
    const hash = consoleTabHash(next);
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
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
      {modalContextHolder}
      <Layout hasSider className="options-shell" data-theme={isDark ? 'dark' : 'light'}>
        <aside className={`options-nav ${navCollapsed ? 'options-navCollapsed' : ''}`}>
          <div className="options-navHeader">
            <div className="options-brand">
              <span className="options-brandMark" aria-hidden="true">
                MR
              </span>
              {!navCollapsed && <span className="options-brandText">Media Recorder</span>}
            </div>
            <Tooltip title={navCollapsed ? '展开导航' : '收起导航'} placement="right">
              <button
                type="button"
                className="options-navToggle"
                aria-label={navCollapsed ? '展开导航' : '收起导航'}
                aria-expanded={!navCollapsed}
                onClick={() => setNavCollapsed((collapsed) => !collapsed)}
              >
                {navCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </button>
            </Tooltip>
          </div>
          <Menu
            mode="inline"
            inlineCollapsed={navCollapsed}
            className="options-menu"
            selectedKeys={[activeTab]}
            onClick={({ key }) => handleTabChange(key)}
            items={NAV_ITEMS}
          />
        </aside>

        <Content className="options-content">
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

          <Spin spinning={loading} tip="加载配置中...">
            {[
              {
                key: 'overview',
                label: '概览',
                children: (
                  <OverviewTab
                    serviceStatus={serviceStatus}
                    queueStatus={taskQueue.status}
                    onRefresh={refreshAll}
                    onOpenLibrary={() => handleTabChange('library')}
                  />
                ),
              },
              {
                key: 'library',
                label: '媒体库',
                children: <MediaLibrary />,
              },
              {
                key: 'tags',
                label: '标签',
                children: (
                  <Space direction="vertical" size="large" className="full-width">
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
                          标签由 AI 分类时自动创建和归并。点击标签可置顶、重命名或合并；点击 ×
                          删除。
                        </Paragraph>
                        {tags.length === 0 ? (
                          <Text type="secondary">
                            暂无标签。运行 AI 分类后，标签会自动出现在这里。
                          </Text>
                        ) : (
                          <Space wrap size={[8, 8]}>
                            {tags.map((tag) => {
                              const label = tag.label || tag.name;
                              return (
                                <Dropdown
                                  key={tag.id}
                                  trigger={['click']}
                                  menu={{
                                    items: [
                                      {
                                        key: 'pin',
                                        label: tag.is_pinned ? '取消置顶' : '置顶',
                                        disabled: saving.tags,
                                      },
                                      {
                                        key: 'rename',
                                        label: '重命名',
                                        disabled: saving.tags,
                                      },
                                      {
                                        key: 'merge',
                                        label: '合并到…',
                                        disabled: saving.tags || tags.length < 2,
                                      },
                                    ],
                                    onClick: ({ key }) => {
                                      if (key === 'pin') {
                                        void handleTogglePinned(tag, tag.is_pinned !== 1);
                                      } else if (key === 'rename') {
                                        openRenameTagModal(tag);
                                      } else if (key === 'merge') {
                                        openMergeTagModal(tag);
                                      }
                                    },
                                  }}
                                >
                                  <Tag
                                    className="tag-chip"
                                    color={tag.is_pinned ? 'gold' : 'cyan'}
                                    closable
                                    title={`${tag.name} · 使用 ${tag.usage_count} 次`}
                                    onClose={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      confirmDeleteTag(tag);
                                    }}
                                  >
                                    {tag.is_pinned ? `📌 ${label}` : label}
                                  </Tag>
                                </Dropdown>
                              );
                            })}
                          </Space>
                        )}
                      </div>
                    </Card>
                  </Space>
                ),
              },
              {
                key: 'tasks',
                label: '任务',
                children: (
                  <Space direction="vertical" size="large" className="full-width">
                    <MediaArchiveCard
                      status={mediaArchiveStatus}
                      summary={taskQueue.status.byType?.archive}
                      savingSave={saving.mediaArchive}
                      savingRun={saving.mediaArchiveRun}
                      onRefresh={() => void handleRefreshMediaArchive()}
                      onToggle={(enabled, targetPath, intervalMinutes, concurrency) =>
                        void handleMediaArchiveToggle(
                          enabled,
                          targetPath,
                          intervalMinutes,
                          concurrency
                        )
                      }
                      onSave={(targetPath, intervalMinutes, concurrency) =>
                        void handleMediaArchiveSave(targetPath, intervalMinutes, concurrency)
                      }
                      onRun={() => void handleMediaArchiveRun()}
                    />
                    <TaskConsole
                      status={taskQueue.status}
                      loading={taskQueue.loading}
                      busy={taskQueue.busy}
                      concurrency={{
                        classify: config.classifyConcurrency,
                        rename: config.renameConcurrency,
                      }}
                      templateDrafts={templateDrafts}
                      onStart={handleStart}
                      onPause={handlePause}
                      onRetryFailed={handleRetryFailed}
                      onClearQueue={handleClearQueue}
                      onRescan={handleRescan}
                      onConcurrencyChange={handleTaskConcurrencyChange}
                      onTemplateChange={(key, value) =>
                        setTemplateDrafts((prev) => ({ ...prev, [key]: value }))
                      }
                      onTemplateSave={(key) => void handleTemplateSave(key)}
                      onTemplateReset={(key) => void handleTemplateReset(key)}
                    />
                  </Space>
                ),
              },
              {
                key: 'trash',
                label: '回收站',
                children: <TrashPage />,
              },
              {
                key: 'settings',
                label: '设置',
                children: (
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

                    <Card
                      className="options-card"
                      title="存储与工作空间"
                      extra={
                        <Button
                          loading={workspaceLoading}
                          onClick={() => void handleRefreshWorkspace()}
                        >
                          刷新
                        </Button>
                      }
                    >
                      {!workspaceInfo ? (
                        <Alert
                          type="info"
                          showIcon
                          message="未连接后端"
                          description="连接后端后可以查看和修改 VFS 工作区路径。"
                        />
                      ) : (
                        <Form layout="vertical">
                          <Form.Item label="当前路径">
                            <Space.Compact className="full-width">
                              <Input readOnly value={workspaceInfo.path} />
                              <Button
                                onClick={() => void handleCopyWorkspacePath(workspaceInfo.path)}
                              >
                                复制
                              </Button>
                            </Space.Compact>
                          </Form.Item>

                          {workspaceInfo.pendingPath && (
                            <Alert
                              type="warning"
                              showIcon
                              style={{ marginBottom: 16 }}
                              message={`待生效路径：${workspaceInfo.pendingPath}`}
                              description="重启后端进程后才会切换；当前仍写入上面的当前路径。"
                            />
                          )}

                          <Form.Item
                            label="路径来源"
                            extra={`默认路径：${workspaceInfo.defaultPath}`}
                          >
                            <Text>{WORKSPACE_SOURCE_LABELS[workspaceInfo.source]}</Text>
                          </Form.Item>

                          <Form.Item
                            label="更改工作区"
                            extra={
                              workspaceOverride
                                ? '当前路径由启动参数或环境变量指定，修改 Options 不会生效。'
                                : '输入绝对路径。保存后需要重启后端才会生效；旧工作区的数据不会被移动或删除。'
                            }
                          >
                            <Space.Compact className="full-width">
                              <Input
                                value={workspaceDraft}
                                disabled={workspaceOverride}
                                placeholder="例如 /Volumes/SSD/vfs-workspace"
                                onChange={(event) => setWorkspaceDraft(event.target.value)}
                                onPressEnter={handleWorkspaceSave}
                              />
                              <Button
                                type="primary"
                                loading={saving.workspace}
                                disabled={
                                  workspaceOverride ||
                                  !workspaceDraft.trim() ||
                                  workspaceDraft.trim() === workspaceInfo.path
                                }
                                onClick={handleWorkspaceSave}
                              >
                                保存
                              </Button>
                            </Space.Compact>
                          </Form.Item>

                          {workspaceOverride && (
                            <Alert
                              type="info"
                              showIcon
                              message="工作区路径由启动配置决定"
                              description="请通过 --workspace 参数或 VFS_WORKSPACE 环境变量修改，然后重启后端。"
                            />
                          )}
                        </Form>
                      )}
                    </Card>

                    <Card className="options-card" title="视频捕获">
                      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                        `re-download` 会识别直链视频后重新下载完整文件；`buffer-only`
                        只保存浏览器已经完整缓冲的字节（多段 Range
                        无空洞才算完整），不会二次下载，适合抖音等带签名或防盗链的站点。流媒体分片（MSE/blob）仍不支持。
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

                        <Form.Item
                          label="捕获格式"
                          extra="仅这些 MIME 类型的视频会被识别为下载候选。"
                        >
                          <Select
                            mode="multiple"
                            value={config.enabledVideoTypes}
                            options={VIDEO_TYPE_OPTIONS}
                            loading={saving.videoCapture}
                            onChange={handleVideoFormatsChange}
                            placeholder="选择至少一种视频格式"
                          />
                        </Form.Item>

                        <Form.Item
                          label="默认捕获模式"
                          extra="buffer-only 只接受已完整缓冲的内容，不补洞、不重试、不二次下载。"
                        >
                          <Select
                            value={config.videoCaptureMode}
                            loading={saving.videoCapture}
                            onChange={handleVideoCaptureModeChange}
                            options={[
                              {
                                value: 're-download',
                                label: '重新下载（re-download）',
                              },
                              {
                                value: 'buffer-only',
                                label: '只收完整缓冲（buffer-only）',
                              },
                            ]}
                          />
                        </Form.Item>

                        <Form.Item
                          label="按站点覆盖"
                          extra="每行 host=mode，例如 douyin.com=buffer-only。默认已包含抖音相关域名。"
                        >
                          <Input.TextArea
                            rows={3}
                            value={videoModeHostDraft}
                            onChange={(event) => setVideoModeHostDraft(event.target.value)}
                            onBlur={handleVideoModeHostSave}
                            placeholder={'douyin.com=buffer-only\ndouyinvod.com=buffer-only'}
                          />
                        </Form.Item>

                        <Form.Item
                          label="补齐缺失区间"
                          extra="默认开启。开启后会对缺失区间在页面上下文向同一媒体 URL 发起 Range 请求，可能产生额外网络请求；关闭时只抓取捕获期间实际观察到的字节。"
                        >
                          <Switch
                            checked={config.videoAssemblyFillGaps === true}
                            loading={saving.videoCapture}
                            onChange={handleFillGapsToggle}
                            checkedChildren="开启"
                            unCheckedChildren="关闭"
                          />
                        </Form.Item>
                      </Form>
                    </Card>

                    <Card className="options-card" title="Ollama 设置">
                      <div className="status-row" style={{ marginBottom: 16 }}>
                        <Space direction="vertical" size={2}>
                          <Text strong>Ollama 状态</Text>
                          <Badge
                            status={serviceStatus.ollamaAvailable ? 'success' : 'error'}
                            text={serviceStatus.ollamaAvailable ? '可用' : '不可用'}
                          />
                        </Space>
                        <Button loading={saving.ollamaHealth} onClick={refreshOllamaHealth}>
                          检查 Ollama
                        </Button>
                      </div>

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
                                const model = ollamaModels.find(
                                  (item) => item.name === option.value
                                );
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
                            onChange={(language) =>
                              saveSetting({ language }, 'config', '语言设置已保存')
                            }
                          />
                        </Form.Item>

                        <Form.Item
                          label="Chat 最大并发数"
                          extra="仅限制 /api/chat 请求；健康检查和模型列表不受此限制。范围 1–8，默认 1。修改后失焦或按 Enter 保存。"
                        >
                          <InputNumber
                            min={1}
                            max={8}
                            value={ollamaConcurrencyDraft}
                            addonAfter="并发"
                            aria-label="Ollama Chat 最大并发数"
                            style={{ width: 200 }}
                            onChange={(value) =>
                              setOllamaConcurrencyDraft(
                                typeof value === 'number' ? value : config.ollamaMaxConcurrency
                              )
                            }
                            onBlur={handleOllamaConcurrencySave}
                            onPressEnter={handleOllamaConcurrencySave}
                          />
                        </Form.Item>
                      </Form>
                    </Card>

                    <Card className="options-card" title="外观">
                      <div className="status-row">
                        <Space direction="vertical" size={2}>
                          <Text strong>主题</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            跟随系统，或固定为亮色 / 暗色。
                          </Text>
                        </Space>
                        <Select
                          value={themeMode}
                          onChange={(value) => changeTheme(value as 'auto' | 'light' | 'dark')}
                          style={{ width: 160 }}
                          options={[
                            { value: 'auto', label: '主题：自动' },
                            { value: 'light', label: '主题：亮色' },
                            { value: 'dark', label: '主题：暗色' },
                          ]}
                        />
                      </div>
                    </Card>
                  </Space>
                ),
              },
            ].find((item) => item.key === activeTab)?.children ?? null}
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
