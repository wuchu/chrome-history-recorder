# Chrome Media Recorder - Architecture Documentation

本文档说明 Chrome Media Recorder 当前的技术架构、设计决策和主要数据流。

## 架构概览

Chrome Media Recorder 使用 **四层**架构：薄 extension UX 层、长驻 app 编排层、ai 域包、vfs 存储与传输层。

```
┌──────────────────── Chrome Extension（薄 UX）─────────────────────┐
│  Side Panel / Options / Offscreen                                  │
│        ▲ chrome.runtime messaging                                  │
│  Background SW                                                     │
│   ├─ DebuggerCaptureController（CDP 捕获）                          │
│   ├─ VideoDownloadManager（offscreen 下载）                         │
│   ├─ 薄 VFSWebSocketClient（RPC + 事件中继）                        │
│   └─ 配置镜像（app 为真源）                                         │
└──────────────┬────────────────────────────────────┬───────────────┘
               │ HTTP files / thumbnails / upload   │ WebSocket RPC + events
               ▼                                    ▼
┌──────────────────────── packages/app（长驻 Node 进程）──────────────┐
│  bootstrap · 任务调度器 · 配置真源 · 事件总线                        │
│    ├─ packages/ai：Ollama 分类 / 重命名 / 健康 / 模型          │
│    └─ packages/vfs：VFSAPI + SQLite/blob/thumbnail + WS/HTTP 服务    │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
                    Ollama（http://localhost:11434）
```

## 组件职责

### 1. Chrome Extension（薄 UX 层）

Extension 只保留浏览器专属能力与界面，不再包含业务调度或 AI 调用。

#### Side Panel / Options / Offscreen (UI Layer)

- **Side Panel（捕获驾驶舱）**: 当前标签页身份、单会话捕获控制、抓取本页（一次性页面扫描/预览/批量保存）、会话指标、实时捕获流、可展开事件日志、会话总结。
- **Options（控制台）**: `概览 / 媒体库 / 标签 / 任务 / 设置` 五个 Tab；全局媒体库从 Side Panel 迁移到 Options，配置和标签治理在此分组。
- **Offscreen**: 视频下载执行上下文。
- **技术**: React 18, TypeScript, Ant Design (Options), CSS Modules, 扩展 offscreen document
- **主要功能**:
  - 通过 HTTP URL 加载文件和缩略图
  - 通过 `chrome.runtime` messaging 接收 Background 中继的事件和会话快照
  - 通过 Background RPC 读写 app 配置、调度器状态与 Ollama 模型

#### Background Service Worker（薄层）

- **职责**: CDP 捕获、视频下载编排、WebSocket 中继、配置镜像、UI 消息转发
- **技术**: Manifest V3 Service Worker
- **主要模块**:
  - `VFSWebSocketClient`: 薄 RPC/事件客户端，不再持有调度或 Ollama 逻辑
  - `FileManager`: 捕获入库（图片 `saveFile`、视频 `POST /upload`）
  - `DebuggerCaptureController`: tab-scoped CDP 捕获与视频候选识别
  - `CaptureSessionStore`: 单捕获会话、计数器、200 条事件日志、`chrome.storage.session` 快照
  - `VideoDownloadManager`: offscreen 下载队列、并发与取消
  - `OneShotCapture`: 右键图片保存、页面扫描、data/blob 字节解析；不 attach debugger，不进入捕获会话
  - 配置镜像: 启动/重连时从 app 拉取，`config:updated` 时更新；真源在 app

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
  - 识别全局资源视频响应，交给 `VideoDownloadManager`
  - 跳过过大文件和不支持格式

### 2. App（`packages/app`）

长驻 Node 进程与组合根：

- `bootstrap`: 构造 `VFSAPI`、`ai` 客户端、配置存储、调度器，启动 WS/HTTP transport
- `Scheduler`: claim → handler → 写回、全局并发、退避、stale recovery、paused/running 意图
- `ConfigStore`: 配置真源（`workspace/config.json`），一次性迁移 chrome.storage，推送镜像
- `EventBus`: 聚合 vfs/scheduler/ai 事件，经 transport 推送给 extension
- 入库钩子: `saveFile` / `POST /upload` 成功后自动 enqueue `classify` + `rename`

### 3. AI（`packages/ai`）

- `OllamaClient`: 分类、重命名、健康检查、模型列表
- 通过注入的 `MediaReader` 直接读取 `VFSAPI` 的缩略图/原图，不再经 WebSocket 传输图片字节
- 分块 base64 编码，避免阻塞 app 事件循环

**媒体资格（eligibility）**：AI 只能处理能产出代表性图像的媒体。`evaluateMediaEligibility` 把三类来源合并为判定：视觉模型原生格式（JPEG/PNG/WebP/GIF）、`vfs` 解码器实际能读取的格式（由 `sharp.format` 推导，经 `VFSAPI.getDecodableImageMimeTypes()` 提供）、以及视频。判定不读取媒体字节，app 在**所有入队路径**（自动 ingest、手动入队、重单、重试失败、全量重扫）上使用它。

**永久错误与 skipped**：无法产出代表性图像的媒体抛出 `UnprocessableMediaError`（`unsupported-format` / `no-representative-frame` / `invalid-media`）。调度器将其一次判定为 `skipped`（终态、不可领取、不计重试、`attempts` 不增），而不是按 `max_attempts` 重试。Ollama 不可用、超时、模型错误、模型输出不可用仍按原策略重试。采集层不变：ICO/BMP 仍会被保存、浏览和归档，只是 AI 流水线跳过它们。

### 4. VFS（`packages/vfs`）

本地存储与传输库（由 `vfs-service` 演进而来）：

- `VFSAPI`: 稳定的文件/任务/标签契约，供 app 进程内调用，也经 WS 暴露给 extension
- SQLite 元数据、content-addressable blob、ffmpeg/sharp 缩略图
- WebSocket Server（RPC + 事件）与 HTTP Server（文件/缩略图/流式上传）
- `setIngestHook` 让 app 在入库后执行自动 enqueue 与 `file:captured` 广播

#### WebSocket Server

- **地址**: `ws://localhost:8765`
- **职责**:
  - 接收 RPC-style API 请求：`{ id, method, params }`
  - 返回统一响应：`{ id, success, data?, error? }`
  - 广播实时事件，如文件捕获、移入回收站、恢复、永久删除、任务状态变化、标签词表变化
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
    source_domain   TEXT,
    captured_at     TEXT NOT NULL,

    -- category 列保留但不再写入（标签是唯一的内容分类来源）
    category        TEXT DEFAULT 'uncategorized',
    ai_filename     TEXT,
    tags            TEXT,
    confidence      REAL DEFAULT 0,
    classified_at   TEXT,
    model_used      TEXT,

    is_starred      INTEGER DEFAULT 0,
    user_notes      TEXT,
    -- 1 = 在回收站中（仍可恢复）；与 deleted_at 成对写入
    is_deleted      INTEGER DEFAULT 0,
    deleted_at      TEXT,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type       TEXT NOT NULL,          -- 'classify' | 'rename' | ...
    target_hash     TEXT NOT NULL REFERENCES files(hash) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|completed|failed|skipped
    priority        INTEGER NOT NULL DEFAULT 5,
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    next_run_at     TEXT,                   -- 失败退避的重试时间
    started_at      TEXT,
    completed_at    TEXT,
    error           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    UNIQUE(task_type, target_hash)          -- 幂等入队
);

CREATE TABLE tags (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,   -- 规范化标签名
    label           TEXT,
    usage_count     INTEGER NOT NULL DEFAULT 0,
    created_by      TEXT NOT NULL DEFAULT 'ai',
    is_pinned       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE tag_aliases (
    alias           TEXT PRIMARY KEY,       -- 已判定的近义/旧名
    tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at      TEXT NOT NULL
);
```

#### Search and Query

`files` 旁边维护一个 FTS5 搜索表 `files_fts`（`ai_filename`、`tags`、`source_url`、`user_notes`），由触发器保持同步；工作区首次打开时按 `PRAGMA user_version` 迁移并回填。英文和短词查询走 FTS5，中文子串与短查询回退到 `LIKE`，因此不依赖分词器也能搜到中文标签和文件名。

库查询在 `ListQuery` 上组合文本、类型、来源域名、捕获时间、收藏、分类状态、多标签 AND/OR 和排序；同时提供 offset 与 `(sortValue, hash)` 游标分页。游标与排序/筛选不匹配时会回到第一页，避免重复项。`orderBy` 通过固定列映射校验，`limit` 上限 500。

#### Blob Storage

- **存储方式**: Hash 平铺存储（Content-addressable）
- **目录结构**: `workspace/blobs/{hash}.{ext}`
- **优势**: 自动去重、无冲突、可恢复

#### Thumbnail Generation

- **图片**: Sharp（resize, format conversion）
- **视频**: FFmpeg（frame extraction）
- **缓存**: `workspace/thumbnails/{hash}-{size}.{ext}`
- **尺寸**: small, medium, large

### 5. Ollama Service

Ollama 提供本地视觉模型 API。app 的 `ai` 包直接调用它进行分类与重命名：

```typescript
POST http://localhost:11434/api/chat
{
  "model": "llava:7b",
  "messages": [{
    "role": "user",
    "content": "...",
    "images": ["<base64_image>"]
  }],
  "stream": false
}
```

- **分类（省调用模式）**：一次视觉调用同时生成标签并完成词表归并。Prompt 注入 top-N 高频标签，允许以 `NEW:` 标记新标签；响应为 JSON，如 `{ "tags": [...], "aliases": { "kitten": "cat" }, "confidence": 0.9 }`。
- **重命名**：独立的视觉调用，只返回展示用文件名；写入 `files.ai_filename`，不重命名物理 blob。
- **标签归并**：AI 返回的规范化标签经 `tag_aliases` 命中已有词表；未命中的标签创建为新词条，`system:*` 标签始终保留。

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

**选择**: 核心表 `files` + `tasks`（统一任务队列）+ `tags` / `tag_aliases`（AI 自生长词表）。

**理由**:

- Hash 作为主键，实现内容寻址存储（Content-addressable）。
- Immutable/Mutable 字段分离，明确数据所有权。
- `tasks` 以 `(task_type, target_hash)` 唯一约束实现幂等入队；`classify` 与 `rename` 可针对同一文件并存。
- 失败任务通过 `attempts` / `next_run_at` / `max_attempts` 退避，并由扩展在唤醒时恢复残留 `processing`。
- 标签词表独立于文件存在，支持 pinned、usage、别名缓存与合并治理；`files.tags` 作为展示与筛选的兼容缓存。

### Decision 3: Workspace Configuration

**选择**: 默认 `~/.vfs-workspace`，按 `--workspace` / `-w` ＞ `VFS_WORKSPACE` ＞ 用户级 launcher 配置 ＞ 默认值 的顺序解析；Options 可修改，重启生效。

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

**launcher 配置**（工作区之外，不能放 `workspace/config.json`，否则打开工作区前读不到）:

```
macOS    ~/Library/Application Support/browser-media-recorder/config.json
Linux    $XDG_CONFIG_HOME/browser-media-recorder/config.json（缺省 ~/.config/...）
Windows  %APPDATA%\browser-media-recorder\config.json

{ "version": 1, "workspacePath": "/absolute/path" }
```

**行为**:

- `getWorkspaceConfig` 由 app 覆盖为 `{ path, defaultPath, source, pendingPath? }`；`setWorkspacePath` 校验后原子写入 launcher 配置并返回 `restartRequired`。
- 保存时与启动时各校验一次：绝对路径、父目录存在且可写、外置卷已挂载、目标为空目录或包含 `vfs.db` 的已有工作区；非空普通目录、根目录、home、当前工作区及其内部路径一律拒绝。
- 运行期不热切换；`pendingPath` 实时读取 launcher 配置，重启后生效。
- 启动时目标不可用则失败退出并打印恢复方式，不回退到默认或历史路径。
- 切换路径不移动、复制或删除旧工作区数据；`workspace/config.json` 随工作区走。

**理由**:

- 用户目录是合理的默认位置，隐藏目录 `.vfs-workspace` 避免视觉干扰。
- 路径是"打开工作区之前"就需要的信息，只能存放在工作区之外的用户级位置。
- CLI/env 保持最高优先级，便于开发与排障；Options 提供普通用户的图形入口。

### Decision 4: VFS API Design

**选择**: RPC-style WebSocket API + HTTP file endpoints。

**WebSocket API Methods**:

- `saveFile(buffer, mimeType, sourceUrl?, capturedAt?)` → `{ hash, duplicate, size }`
- `getFile(hash)` → `{ buffer, mimeType, size, metadata }`
- `trashFile(hash)` → `{ success }`
- `restoreFile(hash)` → `{ success }`
- `restoreAll()` → `{ success, count }`
- `purgeFile(hash)` → `{ success }`
- `emptyTrash()` → `{ success, count }`
- `listFiles(query)` → `{ items, total, hasMore }`（`status`: `active` / `trashed` / `all`）
- `updateMetadata(hash, updates)` → `{ success, updatedMetadata }`
- `getMetadata(hash)` → `metadata`
- `getThumbnail(hash, size)` → `{ buffer, mimeType }`
- `getStats()` → `{ totalFiles, totalSize, byCategory, trashFiles, trashSize }`
- `getWorkspaceConfig()` → `{ path }`
- `setWorkspaceConfig(config)` → `{ success }`
- `enqueueTask({ taskType, hash, priority?, maxAttempts?, requeue? })` → `{ success }`
- `recordSkippedTask({ taskType, hash, error, priority?, maxAttempts? })` → `{ success }`（终态跳过；新建或转换 pending/failed，保留 completed）
- `claimTasks(limit)` → `[ { id, task_type, target_hash, status, attempts, ... } ]`
- `updateTaskStatus({ taskType, hash, status, error?, retryDelayMs? })` → `{ success }`
- `requeueTask(taskType, hash)` / `requeueAll({ taskType?, ineligibleMimeTypes?, skipError? })` → `{ count }`
- `recoverStaleProcessingTasks()` → `{ count }`
- `skipIneligibleTasks({ ineligibleMimeTypes, error, taskTypes? })` → `{ count }`（启动对账）
- `getTasksByHash(hash)` → `[ task ]`
- `getQueueStatus()` → `{ pending, processing, completed, failed, skipped, total, byType }`
- `retryFailedTasks({ taskType?, ineligibleMimeTypes?, skipError? })` → `{ count }`
- `getDecodableImageMimeTypes()` / `getDistinctMimeTypes()` → 资格判定所需的解码能力与索引内 MIME 集合
- `clearQueue(taskType?)` → `{ success }`
- `applyClassification({ hash, tags, aliases?, confidence?, modelUsed? })` → `{ tags }`
- `setFileStarred(hash, starred)` / `updateFileNotes(hash, notes)` → 更新后的元数据
- `addFileTags(hash, tags[])` / `removeFileTags(hash, tags[])` → `{ tags }`（事务合并，保留 `system:*`，用户新标签以 `created_by='user'` 建词条）
- `getSourceDomains(limit?)` → `{ domain, count }[]`
- `getTagVocabulary(limit?)` / `resolveTagName(name)` / `listTags(options)` → 标签词表
- `renameTag({ id, name, label? })` / `mergeTags(sourceId, targetId)` / `deleteTag(id)` / `setTagPinned(id, pinned)` → 标签治理

**理由**:

- RPC 风格便于 Extension 调用和错误处理。
- 每个方法职责单一，便于实现和测试。
- 文件展示和下载通过 HTTP 端点直接完成，减少 Background 转发负担。

### Decision 5: App 作为中央协调器

**架构**:

```
packages/app（长驻 Node 进程）:
├── bootstrap            # 构造 VFSAPI / ai / config / scheduler，启动 transport
├── Scheduler            # claim → handler → 回写，全局并发、退避、stale recovery
├── ConfigStore          # 配置真源 + chrome.storage 一次性迁移 + 镜像推送
├── EventBus             # 聚合 vfs/scheduler/ai 事件 → transport → extension
└── VFSAPI（packages/vfs）+ OllamaClient（packages/ai）

Chrome Extension（薄层）:
├── DebuggerCaptureController  # CDP 捕获
├── VideoDownloadManager       # offscreen 下载
├── 薄 VFSWebSocketClient      # RPC + 事件中继
├── 配置镜像                   # app 推送，capture 使用
└── Side Panel / Options / Offscreen UI
```

**理由**:

- 调度器、Ollama 客户端和配置不再受 MV3 service worker 30 秒空闲挂起影响，可真正长驻运行。
- 调度器和 AI 通过进程内 `VFSAPI` 读写存储，任务操作与媒体读取不再经 WebSocket 序列化。
- extension 只保留浏览器专属能力（CDP、offscreen、UI）与薄中继，bundle 与冷启动时间显著下降。
- 配置以 app 为真源，extension 持镜像，避免 chrome.storage 与后端状态分叉。

### Decision 6: 媒体归档采用"本地工作区 + 单向复制"

**选择**: 工作区（`vfs.db`、`blobs/`、`thumbnails/`）始终留在本地；每个新增媒体在统一任务表中生成一条 `archive` 任务，由 app 内的独立 runner 异步复制到用户指定的挂载目录（如 NAS）。

```
ingest ──▶ tasks(archive, pending)
                 │
   MediaArchiveWorker runner ── claimTasks(1, ['archive'])
                 │
                 ├─ 成功 ──▶ tasks(archive, completed)
                 └─ 失败 ──▶ tasks(archive, pending, next_run_at 退避)

本地工作区                         目标目录（SMB / 外置盘）
blobs/<hash>.<ext>  ──copy──▶  .<hash>.<ext>.part ──rename──▶ <hash>.<ext>
      ▲
      └── files(created_at, hash) 对账游标 + media-archive-state.json
```

- Options 任务页顶部有专用的「媒体归档」卡片，展示已完成/总数、进度条与处理中/待处理/失败计数；TaskConsole 的按类型卡片不重复展示 archive。
- AI `Scheduler` 只领取自己注册的任务类型，归档 runner 只领取 `archive`，互不抢占。
- 归档 runner **不复用 AI 调度器**：`classificationPaused` 默认 true，且 Ollama 不可用时 `Scheduler.tick` 会直接返回；复用会让归档一起停摆。
- 目标目录本身就是去重状态：`<hash>.<ext>` 且 size 一致即视为已归档；状态文件只保存 `activatedAt`、对账游标与换目标时的 requeue 标记。
- 只归档首次启用后新增的文件；更换目标时把游标重置到 `activatedAt`，以 `requeue: true` 重建任务并补齐缺失文件。
- 失败任务通过任务引擎的 `attempts` / `next_run_at` 无限重试（指数退避，上限 1 小时）；`max_attempts` 取极大值，任务不会被永久判失败。
- 目标路径必须已存在且可写；每轮 drain 前校验，未挂载时跳过且不创建目录。归档失败不影响 app 启动。

**为什么不做**:

- 把整个工作区放到 SMB：SQLite WAL 需要共享内存，SMB 上无法打开 WAL 模式的 `vfs.db`。
- 把 `blobs/` 软链到 SMB：HTTP 流式上传使用本地 `.tmp` → `rename` 到 `blobs/`，跨文件系统会 `EXDEV`，视频捕获全部失败。
- 把归档任务交给 AI `Scheduler` 消费：暂停语义与 Ollama 可用性会让归档停摆，大文件复制也会与 AI 推理争抢并发。

## 数据流

### 捕获流程

```
1. 用户在 Side Panel 对当前标签页点击「开始捕获」
   ↓
2. Background 检查全局单会话约束；如有其他会话先停止它
   ↓
3. DebuggerCaptureController attach 当前 tab，CaptureSessionStore 创建会话
   ↓
4. CDP Network.enable 监听网络响应
   ↓
5. Network.responseReceived 记录候选图片请求并过滤 MIME type/大小
   ↓
6. Network.loadingFinished 后调用 Network.getResponseBody
   ↓
7. 解码 base64/body → buffer
   ↓
8. Background FileManager.handleCaptureMedia()
   ↓
9. VFSWebSocketClient.saveFile() → app（ws://localhost:8765）
   ↓
10. app: VFS hash、保存 blob、写入 SQLite，并自动 enqueue AI 任务
    ↓
11. Response: { hash, duplicate, size }
    ↓
12. app 广播 file:captured；extension 中继给 Options 媒体库
    ↓
13. Background 同时把 saved/duplicate/skipped/failed/video/AI 事件写入会话并广播 capture:session
    ↓
14. Side Panel 渲染当前会话的实时捕获流与会话指标；事件日志展开后显示原因
```

会话快照写入 `chrome.storage.session`，用于 Panel 关闭或 Service Worker 重启后的恢复。会话只属于当前标签页并跨页面导航保留；浏览器重启后清除。

### 一次性捕获流程

```
右键图片 ───────────────▶ Context Menu
                              │
侧栏 [抓取本页媒体] ──▶ 注入 DOM 扫描器 ──▶ 候选预览（缩略图/尺寸/类型）
                              │                       │
                              ▼                       ▼
                     http(s) / data: / blob:     用户多选
                              │                       │
                              ▼                       ▼
                     OneShotCapture.resolve ──▶ FileManager.saveFile
                              │                       │
                              ▼                       ▼
                     app ingest hook ──▶ AI / archive / file:captured
```

- 扫描只在用户点击时注入，不常驻页面。
- `http(s)` 由 Background 使用 host permission 拉取；`data:` 在 Background 解码；`blob:` 在页面 MAIN world 读取（受 blob 生命周期和页面 CSP 限制）。
- 默认过滤 128×128 以下、1 KB 以下和 SVG 候选；单次最多 300 个；URL 与 hash 双重去重。
- 一次性捕获**不创建、不修改、不写入**捕获会话，不 attach debugger；保存结果通过 `file:captured` 进入全局媒体库，只出现在扫描预览/结果里，不进入会话 feed 或计数器。

### AI 任务流程

```
1. app 在 saveFile / POST /upload 入库成功后触发 ingest hook
   ↓
2. app 自动 enqueue classify + rename（幂等）
   ↓
3. VFS: insert tasks (UNIQUE(task_type, target_hash), ON CONFLICT DO NOTHING)
   ↓
4. app Scheduler 每 5s tick（或由事件 kick）：
   a. 若暂停 / Ollama 不可用 → 跳过
   b. claimTasks(可用并发) —— 条件 UPDATE 保证原子认领
   ↓
5. classify handler（packages/ai）:
   a. 通过 VFSAPI 读取大缩略图（回退原图）
   b. Ollama 融合调用 → tags + aliases + confidence
   c. VFS applyClassification()：事务解析/创建标签、写别名、保留 system:*、停写 category
   d. 广播 tags:updated
   ↓
6. rename handler:
   a. Ollama 视觉调用 → 展示名
   b. VFS updateMetadata({ ai_filename })
   ↓
7. 成功：updateTaskStatus(completed)，广播 task:completed + 类型事件
   失败：updateTaskStatus(failed, retryDelayMs) —— attempts 未达上限则回到 pending 退避
   ↓
8. app 启动时 recoverStaleProcessingTasks()，按持久化运行意图决定是否启动调度器
```

两种任务只共享全局并发与队列，状态、重试与手动刷新彼此独立；单文件刷新调用
`requeueTask(taskType, hash)`，全量重扫调用 `requeueAll(taskType)`。

### 文件展示流程

```
1. Options 媒体库或 Side Panel 收到媒体事件
   ↓
2. Build HTTP URL:
   - Original: http://localhost:8766/files/{hash}
   - Thumbnail: http://localhost:8766/files/{hash}/thumbnail?size=medium
   ↓
3. Browser loads and caches HTTP response directly
   ↓
4. VFS HTTP Server reads blob/thumbnail from workspace
```

单文件下载使用 `Content-Disposition: attachment`，文件名优先取 `ai_filename` + 真实扩展名，缺失时回退到 `<hash>.<ext>`；文件名会清理路径分隔符、控制字符和保留名，并提供 RFC 5987 的 `filename*`。

#### 媒体导出

Options 媒体库的多选导出在扩展侧完成：它通过 HTTP 逐个读取选中的原图，用流式 zip 写入器打包，并附带 `metadata.json`（hash、MIME、大小、捕获时间、来源、标签、备注、收藏、AI 文件名、置信度、模型）。导出上限为 500 项 / 1 GB，逐文件显示进度，读取失败的条目会跳过并在结果中报告，不会生成半成品归档。

## 风险和缓解

### Risk 1: VFS Service 未启动

**风险**: Extension 需要先连接本地 VFS Service；服务未启动时无法保存文件。

**缓解**:

- Options 概览和 Side Panel 显示 VFS 连接状态。
- WebSocket 客户端支持自动重连。
- README 明确要求先启动 VFS Service。
- 服务可独立运行和调试，启动失败更容易观察。

### Risk 2: 端口冲突或本地防火墙限制

**风险**: 默认端口 8765/8766 可能被占用或被本地安全策略阻止。

**缓解**:

- VFS Service 支持通过环境变量配置端口。
- 端口选择集中在服务入口，便于调整。
- 连接状态和错误日志帮助定位问题。

### Risk 3: 多个 UI 表面共享状态

**风险**: Side Panel、Options 概览和媒体库同时打开时，事件、会话和分类调度状态需要保持一致。

**缓解**:

- Background Service Worker 作为中央协调器，会话快照通过 `capture:session` 广播。
- VFS Service WebSocket Server 广播事件。
- 分类队列持久化在 SQLite 中，避免仅依赖 UI 状态。

### Risk 4: Ollama 服务不可用

**风险**: Ollama 服务未启动或模型不可用时，分类功能失效。

**缓解**:

- Extension 检测 Ollama 健康状态。
- Options 概览、媒体库和 Side Panel 显示 Ollama 状态提示。
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
- `packages/vfs/` — 存储与传输库（VFSAPI、WS/HTTP）
- `packages/ai/` — Ollama 集成
- `packages/app/` — 长驻后端编排
