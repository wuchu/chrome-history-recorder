# Proxy Plugin System Design

## Overview

Proxy 插件系统采用自动发现 + 配置驱动的架构，插件作为独立模块加载，通过标准化接口与 Proxy 核心通信。

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Proxy with Plugin System                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         Proxy Core                                   │   │
│   │                                                                      │   │
│   │   ┌────────────────┐    ┌────────────────┐    ┌────────────────┐   │   │
│   │   │  HTTP Server   │    │  File Storage  │    │  Config Manager │   │   │
│   │   │  (Express)     │    │                │    │                 │   │   │
│   │   └────────────────┘    └────────────────┘    └────────────────┘   │   │
│   │           │                      │                      │           │   │
│   │           │                      │                      │           │   │
│   │           ▼                      ▼                      ▼           │   │
│   │   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │   │                    Plugin Manager                            │   │   │
│   │   │                                                              │   │   │
│   │   │  • discoverPlugins()    扫描插件目录                         │   │   │
│   │   │  • loadPlugins()        加载并初始化插件                      │   │   │
│   │   │  • executeHook()        执行钩子                             │   │   │
│   │   │  • registerRoutes()     注册插件路由                         │   │   │
│   │   │  • getPluginStatus()    获取插件状态                         │   │   │
│   │   │                                                              │   │   │
│   │   └─────────────────────────────────────────────────────────────┘   │   │
│   │                              │                                       │   │
│   │                              │                                       │   │
│   └──────────────────────────────│───────────────────────────────────────│   │
│                                  │                                       │   │
│                                  ▼                                       │   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         Plugin Interface                            │   │
│   │                                                                      │   │
│   │   interface ProxyPlugin {                                           │   │
│   │     name: string;                                                   │   │
│   │     version: string;                                                │   │
│   │     onLoad(context: PluginContext): Promise<void>;                 │   │
│   │     onUnload(): Promise<void>;                                      │   │
│   │     hooks?: { afterSave?, beforeDelete?, ... };                    │   │
│   │     routes?: RouteDefinition[];                                     │   │
│   │   }                                                                 │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                       │   │
│                                  │                                       │   │
│                                  ▼                                       │   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      Loaded Plugins                                 │   │
│   │                                                                      │   │
│   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │   │
│   │   │ ai-classify │    │   future    │    │   future    │            │   │
│   │   │   plugin    │    │   plugin    │    │   plugin    │            │   │
│   │   │             │    │             │    │             │            │   │
│   │   │ hooks:      │    │ hooks:      │    │ hooks:      │            │   │
│   │   │ afterSave   │    │ beforeDelete│    │ afterList   │            │   │
│   │   │             │    │             │    │             │            │   │
│   │   │ routes:     │    │ routes:     │    │ routes:     │            │   │
│   │   │ /classify/* │    │ /ocr/*      │    │ /sync/*     │            │   │
│   │   └─────────────┘    └─────────────┘    └─────────────┘            │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Plugin Discovery

```typescript
// plugins/discovery.ts

export async function discoverPlugins(): Promise<PluginInfo[]> {
  const plugins: PluginInfo[] = [];
  
  // 1. 扫描本地 plugins/ 目录
  const localPluginsDir = path.join(__dirname, '..', 'plugins');
  if (fs.existsSync(localPluginsDir)) {
    const entries = await fs.readdir(localPluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(localPluginsDir, entry.name);
        const pluginFile = path.join(pluginPath, 'plugin.js');
        if (fs.existsSync(pluginFile)) {
          plugins.push({
            type: 'local',
            name: entry.name,
            path: pluginPath,
            entry: pluginFile,
          });
        }
      }
    }
  }
  
  // 2. 扫描 npm 包 @proxy-plugin/*
  const nodeModulesDir = path.join(__dirname, '..', '..', 'node_modules');
  const scopedDir = path.join(nodeModulesDir, '@proxy-plugin');
  if (fs.existsSync(scopedDir)) {
    const entries = await fs.readdir(scopedDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packageJsonPath = path.join(scopedDir, entry.name, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          plugins.push({
            type: 'npm',
            name: entry.name,
            path: path.join(scopedDir, entry.name),
            entry: path.join(scopedDir, entry.name, 'plugin.js'),
          });
        }
      }
    }
  }
  
  return plugins;
}
```

## Plugin Configuration

```yaml
# proxy-config.yaml

server:
  port: 3777
  storagePath: ~/Downloads/chrome-history

plugins:
  ai-classify:
    enabled: true
    priority: 10
    config:
      ollamaEndpoint: http://localhost:11434
      visionModel: llava
      language: zh-CN
      filenameStyle: auto
      
  metadata-extractor:
    enabled: false
    priority: 5
    config:
      extractExif: true
      extractVideoMeta: true
```

## Plugin Manager Implementation

```typescript
// plugins/manager.ts

export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private config: PluginConfigs;
  private proxyCore: ProxyCore;
  
  constructor(proxyCore: ProxyCore, config: PluginConfigs) {
    this.proxyCore = proxyCore;
    this.config = config;
  }
  
  async loadAll(): Promise<void> {
    const discovered = await discoverPlugins();
    
    // 按优先级排序
    const sorted = discovered.sort((a, b) => {
      const priorityA = this.config[a.name]?.priority ?? 0;
      const priorityB = this.config[b.name]?.priority ?? 0;
      return priorityB - priorityA;
    });
    
    for (const pluginInfo of sorted) {
      if (this.config[pluginInfo.name]?.enabled === false) {
        console.log(`○ ${pluginInfo.name}  Disabled (config)`);
        continue;
      }
      
      try {
        await this.loadPlugin(pluginInfo);
        console.log(`● ${pluginInfo.name}  ✓ Loaded`);
      } catch (error) {
        console.log(`✗ ${pluginInfo.name}  Failed: ${error.message}`);
      }
    }
  }
  
  private async loadPlugin(info: PluginInfo): Promise<void> {
    const module = await import(info.entry);
    const plugin: ProxyPlugin = module.default || module;
    
    // 创建插件上下文
    const context: PluginContext = {
      proxy: {
        getConfig: () => this.proxyCore.getConfig(),
        getStoragePath: () => this.proxyCore.getStoragePath(),
        getFile: (hash) => this.proxyCore.getFile(hash),
        getFiles: (query) => this.proxyCore.getFiles(query),
        saveFile: (data) => this.proxyCore.saveFile(data),
        deleteFile: (hash) => this.proxyCore.deleteFile(hash),
      },
      config: this.config[info.name]?.config ?? {},
      logger: createPluginLogger(info.name),
      emit: (event, data) => this.proxyCore.emit(event, data),
    };
    
    // 加载插件
    await plugin.onLoad(context);
    
    // 注册钩子
    if (plugin.hooks?.afterSave) {
      this.proxyCore.registerHook('afterSave', plugin.hooks.afterSave);
    }
    
    // 注册路由
    if (plugin.routes) {
      for (const route of plugin.routes) {
        this.proxyCore.registerRoute(route);
      }
    }
    
    this.plugins.set(info.name, {
      plugin,
      info,
      status: 'running',
    });
  }
  
  async executeHook(name: string, data: unknown): Promise<void> {
    const hookPromises: Promise<void>[] = [];
    
    for (const loaded of this.plugins.values()) {
      const hook = loaded.plugin.hooks?.[name];
      if (hook) {
        hookPromises.push(
          hook(data).catch(error => {
            loaded.plugin.logger.error(`Hook ${name} failed:`, error);
          })
        );
      }
    }
    
    await Promise.all(hookPromises);
  }
  
  getPluginStatus(): PluginStatus[] {
    return Array.from(this.plugins.values()).map(loaded => ({
      name: loaded.info.name,
      status: loaded.status,
      version: loaded.plugin.version,
      hooks: Object.keys(loaded.plugin.hooks ?? {}),
      routes: loaded.plugin.routes?.map(r => r.path) ?? [],
    }));
  }
}
```

## Integration with Server

```typescript
// server.ts 改造

import { PluginManager } from './plugins/manager.js';

const app = express();
const pluginManager = new PluginManager(proxyCore, config.plugins);

// 启动时加载插件
await pluginManager.loadAll();

// 文件保存后执行钩子
app.post('/save-image', async (req, res) => {
  const savedFile = await saveFile(req.body);
  
  // 执行 afterSave 钩子
  await pluginManager.executeHook('afterSave', savedFile);
  
  res.json({ hash: savedFile.hash, filename: savedFile.filename });
});

// 插件状态 API
app.get('/plugins', (req, res) => {
  res.json(pluginManager.getPluginStatus());
});

app.get('/plugins/:name/status', (req, res) => {
  const status = pluginManager.getPluginStatus(req.params.name);
  if (!status) {
    return res.status(404).json({ error: 'Plugin not found' });
  }
  res.json(status);
});
```

## File Structure

```
packages/proxy/src/
├── server.ts              # 主服务（改造）
├── plugin-api.ts          # 插件接口定义
├── plugins/
│   ├── manager.ts         # 插件管理器
│   ├── discovery.ts       # 插件发现
│   ├── context.ts         # 插件上下文
│   ├── hooks.ts           # 钩子执行器
│   └── types.ts           # 类型定义
│   └── ai-classify/       # AI Classify 插件（由 ai-classify-plugin 变更实现）
│       └── plugin.ts
│
├── config/
│   └── proxy-config.yaml  # Proxy 配置文件（新增）
│
└────────────────────────────
```

## Plugin API Types

```typescript
// plugin-api.ts

export interface ProxyPlugin {
  name: string;
  version: string;
  description?: string;
  
  onLoad(context: PluginContext): Promise<void>;
  onUnload(): Promise<void>;
  
  hooks?: {
    afterSave?: (file: SavedFile) => Promise<void>;
    beforeDelete?: (file: StoredFile) => Promise<boolean>;
    beforeList?: (query: ListQuery) => Promise<ListQuery>;
    afterList?: (files: StoredFile[]) => Promise<StoredFile[]>;
  };
  
  routes?: RouteDefinition[];
}

export interface PluginContext {
  proxy: ProxyAPI;
  config: Record<string, unknown>;
  logger: Logger;
  emit: (event: string, data: unknown) => void;
}

export interface SavedFile {
  hash: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  capturedAt: Date;
}

export interface RouteDefinition {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  handler: (req: Request, res: Response) => Promise<void>;
}
```