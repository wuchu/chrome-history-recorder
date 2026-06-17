# Chrome Media Recorder - Architecture Documentation

本文档说明 Chrome Media Recorder 当前的技术架构、设计决策和主要数据流。

## 架构概览

Chrome Media Recorder 使用 **WebSocket + HTTP 双通道**架构，由四个主要组件构成：

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
│  ┌──────────────┐  chrome.runtime  ┌──────────────┐         │
│  │ Side Panel   │◀───────────────▶│ Background   │         │
│  │ (React UI)   │                  │ Service      │         │
│  │              │                  │ Worker       │         │
│  └──────┬───────┘                  └──────┬───────┘         │
│         │                                 │                 │
│         │ HTTP file/thumbnail URLs        │ WebSocket API   │
│         │ http://localhost:8766           │ ws://localhost:8765
└─────────┼─────────────────────────────────┼─────────────────┘
          │                                 │
          ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                       VFS Service                            │
│  ┌───────────────────────┐      ┌────────────────────────┐  │
│  │ WebSocket Server      │      │ HTTP Server            │  │
│  │ API + event channel   │      │ files + thumbnails     │  │
│  │ localhost:8765        │      │ localhost:8766         │  │
│  └──────────┬────────────┘      └───────────┬────────────┘  │
│             │                               │               │
│             └───────────────┬───────────────┘               │
│                             ▼                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ SQLite       │  │ Blob Storage │  │ Thumbnail        │  │
│  │ Metadata     │  │ Files        │  │ Generator        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Ollama Service (Local)                    │
│  HTTP API: http://localhost:11434                            │
│  Vision Models: LLaVA, Moondream                             │
└─────────────────────────────────────────────────────────────┘
```

## 组件职责

### 1. Chrome Extension

Extension 是用户交互和捕获流程的核心。

#### Side Panel (UI Layer)

- **职责**: 用户界面展示、实时状态监控、当前标签页捕获控制、配置入口
- **技术**: React 18, TypeScript, CSS Modules
- **主要功能**:
  - 媒体网格展示
  - 实时捕获流预览
  - VFS / Ollama / 分类队列状态展示
  - 通过 HTTP URL 加载文件和缩略图
  - 通过 `chrome.runtime` messaging 接收 Background 事件

#### DevTools Panel (Migration Fallback)

DevTools Panel 在迁移期仍保留为 fallback 和调试入口，但不再是主捕获和浏览界面。新的主流程由 Chrome Side Panel 触发，并由 Background 统一管理当前标签页捕获状态。

#### Background Service Worker (Business Logic Layer)

- **职责**: 业务逻辑协调、VFS 连接、AI 分类调度、事件广播
- **技术**: Manifest V3 Service Worker
- **主要模块**:
  - `VFSWebSocketClient`: WebSocket 客户端，封装所有 VFS API 调用和连接状态
  - `FileManager`: 文件捕获流程管理（接收媒体数据 → VFS 保存 → 广播事件）
  - `ClassifyScheduler`: 分类队列调度器（从 VFS 获取任务 → Ollama 分类 → 更新元数据）
  - `OllamaClient`: Ollama HTTP API 客户端（健康检查、模型查询、分类调用）
  - `ConfigManager`: 配置管理（Ollama endpoint、模型、并发数等）
  - `DebuggerCaptureController`: 管理 tab-scoped debugger/CDP 捕获状态和图片响应体提取
  - `EventBroadcaster`: 向 Side Panel / DevTools Panel 广播事件

#### Background Debugger / CDP Capture Layer

- **职责**: 拦截网络请求，捕获媒体数据
- **技术**: `chrome.debugger` + Chrome DevTools Protocol Network domain
- **主要功能**:
  - 按标签页 attach debugger 会话
  - 启用 `Network.enable`
  - 监听 `Network.responseReceived` 和 `Network.loadingFinished`
  - 过滤 MIME type 和文件大小
  - 调用 `Network.getResponseBody` 获取图片响应体
  - 将捕获的 buffer 交给 `FileManager.handleCaptureMedia`
  - 跳过过大文件和不支持格式

### 2. VFS Service

VFS Service 是本地 Node.js 服务，负责文件系统、元数据、缩略图和分类队列操作。

#### WebSocket Server

- **地址**: `ws://localhost:8765`
- **职责**:
  - 接收 RPC-style API 请求：`{ id, method, params }`
  - 返回统一响应：`{ id, success, data?, error? }`
  - 广播实时事件，如文件捕获、删除、分类完成、队列变化
  - 维护连接状态和心跳

#### HTTP Server

- **地址**: `http://localhost:8766`
- **职责**:
  - `GET /files/:hash`: 下载原始文件
  - `GET /files/:hash/thumbnail?size=small|medium|large`: 获取缩略图
  - `GET /files/:hash/metadata`: 获取单个文件元数据
  - `GET /stats`: 获取统计信息
  - `GET /health`: 健康检查
  - 提供浏览器原生缓存友好的响应头

#### SQLite Metadata Management

```sql
CREATE TABLE files (
    hash            TEXT PRIMARY KEY,
    blob_ext        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size            INTEGER NOT NULL,
    source_url      TEXT,
    captured_at     TEXT NOT NULL,

    category        TEXT DEFAULT 'uncategorized',
    ai_filename     TEXT,
    tags            TEXT,
    confidence      REAL DEFAULT 0,
    classified_at   TEXT,
    model_used      TEXT,

    is_starred      INTEGER DEFAULT 0,
    user_notes      TEXT,
    is_deleted      INTEGER DEFAULT 0,
    deleted_at      TEXT,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE classify_queue (
    hash            TEXT PRIMARY KEY,
    priority        INTEGER DEFAULT 5,
    status          TEXT DEFAULT 'pending',
    retry_count     INTEGER DEFAULT 0,
    error_message   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
```

#### Blob Storage

- **存储方式**: Hash 平铺存储（Content-addressable）
- **目录结构**: `workspace/blobs/{hash}.{ext}`
- **优势**: 自动去重、无冲突、可恢复

#### Thumbnail Generation

- **图片**: Sharp（resize, format conversion）
- **视频**: FFmpeg（frame extraction）
- **缓存**: `workspace/thumbnails/{hash}-{size}.{ext}`
- **尺寸**: small, medium, large

### 3. Ollama Service

Ollama 提供本地视觉模型 API，用于 AI 分类：

```typescript
POST http://localhost:11434/api/chat
{
  "model": "llava:7b",
  "messages": [{
    "role": "user",
    "content": "Classify this image into: screenshot, photo, meme...",
    "images": ["<base64_image>"]
  }],
  "stream": false
}
```

分类结果解析支持多种格式：

1. **Pipe-separated**: `CATEGORY | FILENAME`
2. **Space-separated**: `CATEGORY FILENAME`
3. **JSON**: `{ "category": "...", "filename": "...", "tags": [...] }`

## 设计决策

### Decision 1: WebSocket + HTTP 双通道

**选择**: WebSocket 用于 API 调用和实时事件，HTTP 用于文件和缩略图传输。

**理由**:

- WebSocket 支持双向通信和事件推送，适合连接状态、队列状态和捕获事件。
- HTTP 更适合大文件、缩略图、浏览器缓存和直接 URL 加载。
- VFS Service 可以独立启动、调试和测试，不依赖 Chrome 生命周期。
- Extension 无需 `nativeMessaging` 权限和 Native Host manifest 注册。

**替代方案**:

- 单纯 WebSocket: 可以统一协议，但文件/缩略图传输无法利用浏览器原生缓存和 URL 加载。
- 单纯 HTTP REST: 请求响应简单，但实时事件需要轮询或额外 SSE/WebSocket。
- Chrome Native Messaging: 无端口绑定问题，但安装复杂、调试困难、连接状态不透明，且无法自然支持多客户端实时事件。

### Decision 2: SQLite Schema Design

**选择**: 单表 `files` + 辅助表 `classify_queue`。

**理由**:

- Hash 作为主键，实现内容寻址存储（Content-addressable）。
- Immutable/Mutable 字段分离，明确数据所有权。
- 分类队列独立表，便于调度和重试。
- 软删除设计，避免误删数据丢失。

### Decision 3: Workspace Configuration

**选择**: 默认 `~/.vfs-workspace`，支持参数传入。

**目录结构**:

```
.vfs-workspace/
├── vfs.db           # SQLite database
├── blobs/           # Flat blob storage
│   ├── abc123.jpg
│   └── def456.mp4
└── thumbnails/      # On-demand thumbnail cache
    ├── abc123-small.jpg
    └── ...
```

**理由**:

- 用户目录是合理的默认位置。
- 隐藏目录 `.vfs-workspace` 避免视觉干扰。
- 参数传入支持自定义位置（如外部存储）。

### Decision 4: VFS API Design

**选择**: RPC-style WebSocket API + HTTP file endpoints。

**WebSocket API Methods**:

- `saveFile(buffer, mimeType, sourceUrl?, capturedAt?)` → `{ hash, duplicate, size }`
- `getFile(hash)` → `{ buffer, mimeType, size, metadata }`
- `deleteFile(hash, hard?)` → `{ success }`
- `listFiles(query)` → `{ items, total, hasMore }`
- `updateMetadata(hash, updates)` → `{ success, updatedMetadata }`
- `getMetadata(hash)` → `metadata`
- `getThumbnail(hash, size)` → `{ buffer, mimeType }`
- `getStats()` → `{ totalFiles, totalSize, byCategory }`
- `getWorkspaceConfig()` → `{ path }`
- `setWorkspaceConfig(config)` → `{ success }`
- `enqueueClassification(hash, priority)` → `{ success }`
- `getQueueStatus()` → `{ pending, processing, completed, failed }`
- `getPendingTasks(limit)` → `[ { hash, priority, status } ]`
- `updateTaskStatus(hash, status, error?)` → `{ success }`
- `retryFailedTasks()` → `{ count }`
- `clearQueue()` → `{ success }`

**理由**:

- RPC 风格便于 Extension 调用和错误处理。
- 每个方法职责单一，便于实现和测试。
- 文件展示和下载通过 HTTP 端点直接完成，减少 Background 转发负担。

### Decision 5: Background Service Worker 作为中央协调器

**架构**:

```
Extension Background Service Worker:
├── VFSWebSocketClient   # WebSocket 客户端
├── FileManager          # 捕获媒体保存流程
├── DebuggerCaptureController # Side Panel 触发的 tab-scoped CDP 捕获
├── OllamaClient         # HTTP 客户端（调用本地 Ollama）
├── ClassifyScheduler    # 分类任务调度器
├── EventBroadcaster     # 向 Side Panel / DevTools Panel 广播事件
└── ConfigManager        # 配置管理

Side Panel:
├── React UI             # 展示媒体网格
├── HTTP URLs            # 加载文件和缩略图
├── chrome.runtime messaging # 接收 Background 事件
└── Options/Settings     # 用户配置
```

**理由**:

- Background Service Worker 是 Manifest V3 的标准业务协调层。
- VFS 连接和分类调度集中管理，避免多个 UI 面板重复调度。
- Side Panel 保持偏 UI，捕获状态集中在 Background，降低状态同步复杂度。

## 数据流

### 捕获流程

```
1. 用户在 Side Panel 对当前标签页点击 Start Capture
   ↓
2. Background DebuggerCaptureController attach 当前 tab
   ↓
3. CDP Network.enable 监听网络响应
   ↓
4. Network.responseReceived 记录候选图片请求并过滤 MIME type/大小
   ↓
5. Network.loadingFinished 后调用 Network.getResponseBody
   ↓
6. 解码 base64/body → buffer
   ↓
7. Background FileManager.handleCaptureMedia()
   ↓
8. VFSWebSocketClient.saveFile() → ws://localhost:8765
   ↓
9. VFS Service: hash, save blob, insert SQLite
   ↓
10. Response: { hash, duplicate, size }
    ↓
11. FileManager.broadcastEvent('file:captured', { hash, mimeType, size })
    ↓
12. Side Panel receives event and renders file/thumbnail HTTP URLs
```

### 分类流程

```
1. FileManager 检测新文件（image/video）
   ↓
2. VFSWebSocketClient.enqueueClassification(hash)
   ↓
3. VFS Service: insert classify_queue (status: pending)
   ↓
4. ClassifyScheduler 按配置检查队列
   ↓
5. VFSWebSocketClient.getPendingTasks(concurrency)
   ↓
6. For each task:
   a. VFSWebSocketClient.getFile(hash) → buffer
   b. OllamaClient.classify(buffer, prompt)
   c. Parse result: category, filename, tags
   d. VFSWebSocketClient.updateMetadata(hash, { category, ai_filename, tags })
   e. VFSWebSocketClient.updateTaskStatus(hash, 'completed')
   f. EventBroadcaster broadcasts classification events
```

### 文件展示流程

```
1. DevTools Panel receives file metadata
   ↓
2. Build HTTP URL:
   - Original: http://localhost:8766/files/{hash}
   - Thumbnail: http://localhost:8766/files/{hash}/thumbnail?size=medium
   ↓
3. Browser loads and caches HTTP response directly
   ↓
4. VFS HTTP Server reads blob/thumbnail from workspace
```

## 风险和缓解

### Risk 1: VFS Service 未启动

**风险**: Extension 需要先连接本地 VFS Service；服务未启动时无法保存文件。

**缓解**:

- DevTools Panel 显示 VFS 连接状态。
- WebSocket 客户端支持自动重连。
- README 明确要求先启动 VFS Service。
- 服务可独立运行和调试，启动失败更容易观察。

### Risk 2: 端口冲突或本地防火墙限制

**风险**: 默认端口 8765/8766 可能被占用或被本地安全策略阻止。

**缓解**:

- VFS Service 支持通过环境变量配置端口。
- 端口选择集中在服务入口，便于调整。
- 连接状态和错误日志帮助定位问题。

### Risk 3: 多个 DevTools Panel 共享状态

**风险**: 多个 DevTools Panel 同时打开时，事件和分类调度状态需要保持一致。

**缓解**:

- Background Service Worker 作为中央协调器。
- VFS Service WebSocket Server 广播事件。
- 分类队列持久化在 SQLite 中，避免仅依赖 UI 状态。

### Risk 4: Ollama 服务不可用

**风险**: Ollama 服务未启动或模型不可用时，分类功能失效。

**缓解**:

- Extension 检测 Ollama 健康状态。
- Options/DevTools UI 显示 Ollama 状态提示。
- 分类失败时保留原文件，仅标记任务失败或保持未分类。
- 用户可选择不安装 Ollama，仅使用基础捕获功能。

### Risk 5: SQLite 数据丢失

**风险**: SQLite 文件损坏或误删导致元数据丢失。

**缓解**:

- blob 文件独立存储，即使 SQLite 损坏也能恢复物理文件。
- Hash 存储使物理文件无冲突。
- 未来可考虑 WAL 模式、备份或导出能力提高可靠性。

## 未来扩展

### 多语言分类支持

支持中文和英文分类提示，可通过配置面板切换或扩展：

```typescript
const PROMPTS = {
  zh: '将这张图片分类到：截图、照片、表情包、插图、证件...',
  en: 'Classify this image into: screenshot, photo, meme, illustration...',
};
```

### 文件名风格配置

支持多种文件名生成风格：

- **Hash**: `{hash}.jpg`（默认，防冲突）
- **AI Name**: `{ai_filename}.jpg`（智能命名）
- **Timestamp**: `{YYYY-MM-DD_HH-mm-ss}.jpg`（时间戳）
- **Custom**: 用户自定义模板

### 批量导出和迁移

可通过 API 导出文件和元数据，支持迁移到其他存储方案。

## 相关文档

- [README.md](README.md) - 项目概述和快速开始
- [Extension README](packages/extension/README.md) - Chrome 扩展说明
- [VFS Service README](packages/vfs-service/README.md) - VFS Service 说明
