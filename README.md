# Chrome Media Recorder

一个专为 Chrome 浏览器设计的媒体自动捕获系统，使用 DevTools API 拦截网页图片和视频，通过 WebSocket + HTTP 双通道架构保存到本地文件系统。

## 项目简介

本项目能够自动捕获和保存用户浏览网页时看到的图片和视频，无需手动保存每个文件。系统集成了 AI 分类功能，自动对捕获的媒体文件进行智能分类和命名。

### 核心特性

- **Chrome 专属**: 支持 Chrome 88+，使用 Manifest V3 和 DevTools API
- **WebSocket + HTTP 双通道**: WebSocket 用于实时通信和事件推送，HTTP 用于文件下载和缩略图获取
- **DevTools + Options 集成**: 在 Chrome DevTools 中集成专用媒体面板，并通过扩展 Options 页面管理程序配置
- **智能去重**: 基于 SHA-256 内容哈希，自动防止重复保存
- **多格式支持**: 图片（JPEG、PNG、WebP、GIF、BMP）和视频（MP4、WebM、MOV、AVI）
- **AI 分类**: 集成 Ollama，使用视觉模型自动分类和命名文件

## 项目结构

```
chrome-history-recorder/
├── packages/
│   ├── extension/          # Chrome 扩展 → [详细说明](packages/extension/README.md)
│   └── vfs-service/        # VFS Service (WebSocket + HTTP Server) → [详细说明](packages/vfs-service/README.md)
├── openspec/               # 项目规划和规范文档
├── package.json            # Monorepo 根配置
└── pnpm-workspace.yaml     # pnpm 工作区配置
```

## 架构说明

本项目使用 **WebSocket + HTTP 双通道**架构：

1. **WebSocket Server (端口 8765)**: 用于 API 调用和实时事件推送
   - 文件操作 API（保存、删除、列表）
   - 分类队列管理
   - 实时事件广播（文件捕获、删除、分类完成）

2. **HTTP Server (端口 8766)**: 用于文件下载和缩略图获取
   - 文件下载 (`GET /files/:hash`)
   - 缩略图获取 (`GET /files/:hash/thumbnail`)
   - 服务状态 (`GET /health`, `GET /stats`)
   - 浏览器原生缓存支持

优势：

- **独立启动和调试**: VFS Service 可独立启动，不依赖 Chrome
- **实时事件推送**: WebSocket 支持实时广播文件捕获、分类等事件
- **浏览器缓存**: HTTP 端点支持浏览器原生缓存，提升加载速度
- **更简单的权限**: Extension 无需 `nativeMessaging` 特殊权限

## 快速开始

### 前置要求

- Node.js 18+
- pnpm 8+
- Chrome 88+
- Ollama（可选，用于 AI 分类）

### 安装

```bash
# 安装依赖
pnpm install

# 构建 VFS Service
pnpm --filter vfs-service build

# 构建 Extension
pnpm --filter extension build
```

### 启动 VFS Service

VFS Service 需要在 Extension 加载前启动：

```bash
# 启动 VFS Service（WebSocket + HTTP Server）
pnpm --filter vfs-service start

# 或使用开发模式（监听代码变化）
pnpm dev
```

服务启动后会监听：
- WebSocket: `ws://localhost:8765`
- HTTP: `http://localhost:8766`

### 加载扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `packages/extension/.wxt/chrome-mv3/` 目录
5. Extension 会自动连接到 VFS Service

### 使用

1. 确保 VFS Service 正在运行
2. 在任意网页打开 DevTools (F12)
3. 切换到 "Media Recorder" 面板
4. 查看 VFS 连接状态（绿色 ● 表示已连接）
5. 点击 "Start Capture" 开始捕获媒体
6. 捕获的图片和视频将自动保存到 `~/.vfs-workspace/`

### 配置 AI 分类

如果希望启用 AI 分类功能：

```bash
# 安装 Ollama（如果尚未安装）
# macOS: https://ollama.ai/download
# Linux: curl -fsSL https://ollama.ai/install.sh | sh

# 下载视觉模型
ollama pull llava:7b

# 启动 Ollama 服务
ollama serve
```

AI 分类会在捕获文件后加入本地 VFS 分类队列。扩展 Options 页面可以从本地 Ollama `/api/tags` 查询已安装模型，并通过下拉框选择用于后续任务的视觉模型；模型选择会立即保存，刷新模型列表不会覆盖当前选择。AI 分类默认暂停，Options 页面和分类进度区域提供开始/暂停控制；暂停只会停止领取新的待处理任务，已经处理中的任务会自然完成或失败。

这里的“重命名”指更新 VFS 元数据中的 `ai_filename` 智能文件名，不会物理重命名、移动、导出或删除 hash 存储的原始 blob 文件。用户也可以在媒体详情或卡片快捷操作中将单个图片/视频重新加入分类与智能命名队列。

## 子模块文档

| 模块        | 说明                           | 文档                                        |
| ----------- | ------------------------------ | ------------------------------------------- |
| extension   | Chrome 扩展，DevTools 面板与 Background AI 分类 | [README.md](packages/extension/README.md)   |
| vfs-service | VFS Service（WebSocket + HTTP、队列与元数据存储） | [README.md](packages/vfs-service/README.md) |

## VFS Service 端点

### WebSocket API (ws://localhost:8765)

支持的 API 方法：

- `saveFile`: 保存文件
- `getFile`: 获取文件
- `deleteFile`: 删除文件
- `listFiles`: 列出文件
- `updateMetadata`: 更新元数据
- `getMetadata`: 获取元数据
- `getThumbnail`: 获取缩略图（WebSocket 方式）
- `getStats`: 获取统计
- `getWorkspaceConfig`: 获取工作空间配置
- `enqueueClassification`: 加入分类队列
- `getQueueStatus`: 获取队列状态
- `getPendingTasks`: 获取待处理任务
- `updateTaskStatus`: 更新任务状态
- `retryFailedTasks`: 重试失败任务
- `clearQueue`: 清空队列

### HTTP API (http://localhost:8766)

| 端点                          | 说明                 |
| ----------------------------- | -------------------- |
| `GET /files/:hash`            | 下载文件             |
| `GET /files/:hash/thumbnail`  | 获取缩略图（支持 ?size=small/medium/large） |
| `GET /files/:hash/metadata`   | 获取文件元数据       |
| `GET /stats`                  | 获取统计信息         |
| `GET /health`                 | 健康检查             |
| `GET /`                       | 服务信息             |

### 实时事件

WebSocket 会广播以下事件：

- `vfs:connected`: VFS 连接确认
- `vfs:disconnected`: VFS 断开通知
- `file:captured`: 文件捕获完成
- `file:deleted`: 文件删除完成
- `classify:queued`: AI 分类任务已入队
- `classify:started`: AI 分类任务开始处理
- `classify:complete`: AI 分类任务处理完成
- `classify:failed`: AI 分类任务处理失败
- `classify:scheduler`: AI 分类调度器运行/暂停状态变化
- `file:classified`: AI 分类完成
- `queue:updated`: 队列状态更新

## 技术栈

- **扩展框架**: WXT 0.20+
- **前端框架**: React 18+
- **语言**: TypeScript 5.6+
- **通信协议**: WebSocket (ws), HTTP (Node.js http module)
- **数据库**: SQLite (better-sqlite3)
- **图像处理**: Sharp
- **视频处理**: FFmpeg (ffmpeg-static)
- **AI 模型**: Ollama (LLaVA, Moondream)

## 开发

### 开发模式

```bash
# 启动开发模式
pnpm dev

# 不自动打开浏览器
pnpm dev:no-browser

# 单独启动各组件
pnpm --filter extension dev          # 启动 Extension 开发模式
pnpm --filter vfs-service dev        # 监听 VFS Service 代码变化
pnpm --filter vfs-service dev:start  # 启动 VFS Service
```

### 测试

```bash
# 运行 VFS Service 测试
pnpm --filter vfs-service test

# 运行 Extension 测试
pnpm --filter extension test

# 运行所有测试
pnpm test
```

### 构建

```bash
# 构建所有包
pnpm build

# 或单独构建
pnpm --filter vfs-service build
pnpm --filter extension build
```

## 工作空间配置

默认情况下，捕获的媒体文件保存在 `~/.vfs-workspace/` 目录：

```
.vfs-workspace/
├── vfs.db           # SQLite 数据库（元数据索引）
├── blobs/           # 物理文件存储（hash 平铺）
│   ├── abc123.jpg
│   ├── def456.mp4
│   └── ...
└── thumbnails/      # 缩略图缓存
    ├── abc123-100.jpg
    └── ...
```

可以通过启动 VFS Service 时的 `--workspace` / `-w` 参数修改工作空间路径。AI 分类配置通过扩展 Options 页面管理。

## 端口配置

VFS Service 默认端口可通过环境变量自定义：

```bash
# WebSocket Server 端口
export VFS_WS_PORT=8765

# HTTP Server 端口
export VFS_HTTP_PORT=8766
```

## 许可证

MIT License