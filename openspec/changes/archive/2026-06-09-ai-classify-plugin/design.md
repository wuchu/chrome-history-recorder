# AI Classify Plugin Design

## Overview

AI Classify 插件复用核心分类逻辑，作为 Proxy 插件提供后台分类服务。支持两种运行模式：
- **插件模式**：作为 Proxy 插件，通过 afterSave 钩子自动处理新文件
- **CLI 模式**：独立 CLI 工具，手动启动和监控

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          AI Classify Dual Mode                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        AIClassifyCore                                    │   │
│   │                                                                         │   │
│   │   • 队列管理 (pending, processing, completed, failed)                   │   │
│   │   • 分类逻辑 (classifyFile)                                              │   │
│   │   • 组织逻辑 (organizeFile)                                              │   │
│   │   • 状态追踪 (getStatus, getResults)                                     │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                         │
│                                      │                                         │
│                    ┌─────────────────┴─────────────────┐                       │
│                    │                                   │                        │
│                    ▼                                   ▼                        │
│   ┌─────────────────────────────┐     ┌─────────────────────────────┐        │
│   │      CLI Mode               │     │      Plugin Mode             │        │
│   │                             │     │                             │        │
│   │   cli.ts                    │     │   plugin.ts                 │        │
│   │                             │     │                             │        │
│   │   • 命令行参数解析           │     │   • 实现 ProxyPlugin 接口    │        │
│   │   • 炫酷 UI 输出            │     │   • onLoad/onUnload         │        │
│   │   • 键盘交互                │     │   • afterSave 钩子          │        │
│   │   • 目录监控启动            │     │   • 路由注册                 │        │
│   │                             │     │   • WebSocket 事件发射       │        │
│   │                             │     │                             │        │
│   │   启动: ai-classify start   │     │   启动: Proxy 加载           │        │
│   │                             │     │                             │        │
│   └─────────────────────────────┘     └─────────────────────────────┘        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Core Abstraction

```typescript
// ai-classify/src/core.ts

export class AIClassifyCore {
  private config: Config;
  private queue: QueueManager;
  private classifier: Classifier;
  private organizer: Organizer;
  private results: ResultStore;
  
  constructor(config: Config) {
    this.config = config;
    this.queue = new QueueManager();
    this.classifier = new Classifier(config);
    this.organizer = new Organizer(config);
    this.results = new ResultStore();
  }
  
  // 入队方法（CLI 和插件共用）
  async enqueue(file: FileInput): Promise<void> {
    const task = this.queue.add(file);
    await this.processNext();
  }
  
  // 处理队列
  private async processNext(): Promise<void> {
    while (this.queue.hasPending() && this.canProcess()) {
      const task = this.queue.getNext();
      await this.processTask(task);
    }
  }
  
  // 处理单个任务
  private async processTask(task: Task): Promise<void> {
    try {
      const result = await this.classifier.classify(task.path);
      const outputPath = await this.organizer.organize(task, result);
      
      this.queue.complete(task, result);
      this.results.save(task.hash, result, outputPath);
      
      // 发射完成事件（插件模式使用）
      this.emit('classify:complete', { hash: task.hash, result, outputPath });
    } catch (error) {
      this.queue.fail(task, error);
      this.emit('classify:failed', { hash: task.hash, error });
    }
  }
  
  // 状态查询（插件 API 使用）
  getStatus(): ClassifyStatus {
    return {
      queue: this.queue.getStats(),
      processing: this.queue.getCurrent(),
      results: this.results.getCount(),
    };
  }
  
  // 结果查询（插件 API 使用）
  getResults(query: ResultQuery): ClassifyResult[] {
    return this.results.query(query);
  }
  
  // 重新处理（插件 API 使用）
  async reprocess(hash: string): Promise<void> {
    const result = this.results.get(hash);
    if (result) {
      this.results.delete(hash);
      await this.enqueue(result.inputFile);
    }
  }
  
  // 事件发射（由 plugin.ts 模式使用）
  private emit(event: string, data: unknown): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, data);
    }
  }
  
  // 设置事件发射器（插件模式）
  setEventEmitter(emitter: EventEmitter): void {
    this.eventEmitter = emitter;
  }
}
```

## Plugin Implementation

```typescript
// proxy/plugins/ai-classify/plugin.ts

import { ProxyPlugin, PluginContext, SavedFile } from '../../plugin-api.js';
import { AIClassifyCore } from '../../../ai-classify/src/core.js';

export class AIClassifyPlugin implements ProxyPlugin {
  name = 'ai-classify';
  version = '0.2.0';
  
  private core: AIClassifyCore;
  private context: PluginContext;
  
  hooks = {
    afterSave: async (file: SavedFile) => {
      // 新文件保存后自动入队
      await this.core.enqueue({
        hash: file.hash,
        path: file.path,
        mimeType: file.mimeType,
        url: file.url,
      });
    }
  };
  
  routes = [
    {
      path: '/classify/status',
      method: 'GET',
      handler: async (req, res) => {
        res.json(this.core.getStatus());
      }
    },
    {
      path: '/classify/results',
      method: 'GET',
      handler: async (req, res) => {
        const results = this.core.getResults(req.query);
        res.json(results);
      }
    },
    {
      path: '/classify/results/:hash',
      method: 'GET',
      handler: async (req, res) => {
        const result = this.core.getResult(req.params.hash);
        if (!result) {
          return res.status(404).json({ error: 'Result not found' });
        }
        res.json(result);
      }
    },
    {
      path: '/classify/reprocess/:hash',
      method: 'POST',
      handler: async (req, res) => {
        await this.core.reprocess(req.params.hash);
        res.json({ success: true });
      }
    },
    {
      path: '/classify/config',
      method: 'GET',
      handler: async (req, res) => {
        res.json(this.context.config);
      }
    }
  ];
  
  async onLoad(context: PluginContext): Promise<void> {
    this.context = context;
    
    // 初始化核心分类引擎
    this.core = new AIClassifyCore({
      ollamaEndpoint: context.config.ollamaEndpoint ?? 'http://localhost:11434',
      visionModel: context.config.visionModel ?? 'llava',
      language: context.config.language ?? 'zh-CN',
      filenameStyle: context.config.filenameStyle ?? 'auto',
      input: context.proxy.getStoragePath(),
      output: path.join(context.proxy.getStoragePath(), 'organized'),
    });
    
    // 设置事件发射器（通过 context.emit 发送 WebSocket 事件）
    this.core.setEventEmitter({
      emit: (event, data) => context.emit(`classify:${event}`, data)
    });
    
    await this.core.initialize();
    
    context.logger.info('AI Classify plugin loaded');
    context.logger.info(`Ollama endpoint: ${context.config.ollamaEndpoint}`);
  }
  
  async onUnload(): Promise<void> {
    await this.core.stop();
    this.context.logger.info('AI Classify plugin unloaded');
  }
}

export default new AIClassifyPlugin();
```

## WebSocket Events

插件通过 context.emit 发射事件，由 Proxy WebSocket 服务转发给客户端：

```typescript
// classify:started
{
  "event": "classify:started",
  "data": {
    "hash": "a1b2c3d4"
  },
  "timestamp": "2024-01-15T14:32:00Z"
}

// classify:progress (可选)
{
  "event": "classify:progress",
  "data": {
    "hash": "a1b2c3d4",
    "confidence": 0.78
  },
  "timestamp": "2024-01-15T14:32:05Z"
}

// classify:complete
{
  "event": "classify:complete",
  "data": {
    "hash": "a1b2c3d4",
    "category": "cat",
    "filename": "慵懒猫咪在窗台晒太阳.jpg",
    "confidence": 0.92,
    "tags": ["猫", "黑白", "慵懒", "窗台", "阳光"],
    "outputPath": "organized/cat/慵懒猫咪在窗台晒太阳.jpg"
  },
  "timestamp": "2024-01-15T14:32:10Z"
}

// classify:failed
{
  "event": "classify:failed",
  "data": {
    "hash": "a1b2c3d4",
    "error": "Connection timeout"
  },
  "timestamp": "2024-01-15T14:32:10Z"
}
```

## CLI Mode Updates

CLI 模式复用核心逻辑，添加炫酷 UI：

```typescript
// cli.ts 改造

import { AIClassifyCore } from './core.js';
import { displayStartup, ProgressUI, displayResultCard } from './ui/index.js';

program.command('start')
  .action(async () => {
    const config = await ensureConfig(process.cwd());
    const core = new AIClassifyCore(config);
    
    // 显示启动画面
    displayStartup(config);
    
    // 初始化核心
    await core.initialize();
    
    // 启动进度 UI
    const progressUI = new ProgressUI(core);
    
    // 监听事件更新 UI
    core.on('classify:started', (task) => progressUI.started(task));
    core.on('classify:complete', (result) => {
      progressUI.completed(result);
      displayResultCard(result);
    });
    
    // 启动键盘处理
    const keyboard = new KeyboardHandler(core);
    
    // 启动目录监控
    await core.startWatching(config.input);
  });
```

## File Structure

```
packages/ai-classify/src/
├── core.ts              # 核心分类引擎（新增，从 index.ts 抽取）
├── index.ts             # 导出 AIClassifyCore（改造）
├── cli.ts               # CLI 入口（改造，使用 core.ts）
├── ui/                  # 炫酷 UI（由 enhance-cli-experience 实现）
│   └── ...
│
└── plugins/             # 插件模式支持
    └── proxy/
        └── plugin.ts    # Proxy 插件实现
        └── package.json # 插件包定义

packages/proxy/plugins/
└── ai-classify/
    └── plugin.ts        # 指向 ai-classify/src/plugins/proxy/plugin.ts
```

## Dual Mode Comparison

| 功能 | CLI 模式 | 插件模式 |
|------|---------|---------|
| 启动方式 | `ai-classify start` | Proxy 启动时自动加载 |
| 文件入队 | 目录监控扫描 | Proxy afterSave 钩子 |
| 状态显示 | 炫酷 CLI 进度 | Proxy API + WebSocket |
| 用户交互 | 键盘控制 | HTTP API |
| 配置来源 | .ai-classify.yaml | proxy-config.yaml plugins.ai-classify.config |
| 输出位置 | 用户配置 | Proxy storage organized 子目录 |

## Dependencies to Add

```json
{
  "dependencies": {
    // 无新增依赖，复用现有
  }
}
```