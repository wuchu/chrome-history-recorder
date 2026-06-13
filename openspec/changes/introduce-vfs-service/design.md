## Context

当前系统由三个主要组件构成：

1. **Proxy Server** (packages/proxy) - Node.js HTTP + WebSocket 服务，承担文件存储、API 路由、事件广播、插件管理等多重职责
2. **Extension** (packages/extension) - Chrome DevTools 扩展，负责网络监听和 UI 展示
3. **Extension Background AI 分类** (packages/extension/src/background/classify) - AI 分类引擎，直接调用 Ollama 并通过 VFS 更新元数据

当前架构的问题：
- Extension 由于浏览器沙箱无法直接操作本地文件，必须通过 HTTP/WebSocket 与 Proxy 通信
- Proxy 承担过多职责，部署复杂（需要独立启动 Node.js 服务）
- 业务逻辑分散在 Proxy Plugin 和 Extension 之间，边界模糊

**Constraints**:
- Chrome Extension 必须使用 Native Messaging 才能安全访问本地文件系统
- Native Host 必须实现 stdin/stdout JSON 协议（4 字节长度前缀）
- 用户目录默认创建 `.vfs-workspace` 工作空间

## Goals / Non-Goals

**Goals:**
- 实现清晰的职责分层：VFS = 纯存储引擎，Extension = 业务逻辑层
- 简化部署体验：Chrome 自动管理 Native Host 生命周期
- 统一元数据管理：SQLite 索引 + Hash 平铺存储
- 保持现有功能：文件捕获、AI 分类、UI 展示

**Non-Goals:**
- 数据迁移（旧 Proxy 数据格式迁移到新 VFS）
- 多虚拟视图（只支持单一虚拟路径）
- 用户手动修改 SQLite（只通过 UI 或 API 修改）
- 支持其他浏览器（仅 Chrome）

## Decisions

### Decision 1: Native Messaging vs WebSocket

**选择**: Native Messaging

**理由**:
- Chrome 自动管理 Native Host 生命周期，无需手动启动服务
- 无端口绑定问题，避免防火墙和端口冲突
- 更安全：只有指定 Extension ID 可连接
- 单例模式：每个 Extension 只有一个 Native Host 实例

**替代方案**:
- WebSocket: 需要手动启动服务，端口管理复杂，但支持多客户端
- HTTP REST: 同样需要端口管理，且无法实现双向实时通信

### Decision 2: SQLite Schema Design

**选择**: 单表 `files` + 辅助表 `classify_queue`

**Schema**:
```sql
CREATE TABLE files (
    -- Immutable (capture-time)
    hash            TEXT PRIMARY KEY,
    blob_ext        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size            INTEGER NOT NULL,
    source_url      TEXT,
    captured_at     TEXT NOT NULL,
    
    -- Mutable (AI classification)
    category        TEXT DEFAULT 'uncategorized',
    ai_filename     TEXT,
    tags            TEXT,  -- JSON array
    confidence      REAL DEFAULT 0,
    classified_at   TEXT,
    model_used      TEXT,
    
    -- Mutable (user)
    is_starred      INTEGER DEFAULT 0,
    user_notes      TEXT,
    is_deleted      INTEGER DEFAULT 0,
    deleted_at      TEXT,
    
    -- Metadata
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
```

**理由**:
- Hash 作为主键，实现内容寻址存储（Content-addressable）
- Immutable/Mutable 字段分离，明确数据所有权
- 分类队列独立表，便于 Extension 管理任务状态
- 软删除设计，避免误删数据丢失

### Decision 3: Workspace Configuration

**选择**: 默认 `~/.vfs-workspace`，支持参数传入

**目录结构**:
```
.vfs-workspace/
├── vfs.db           # SQLite database
├── blobs/           # Flat blob storage
│   ├── abc123.jpg
│   ├── def456.mp4
│   └── ...
└── thumbnails/      # On-demand thumbnail cache (optional)
    ├── abc123-100.jpg
    └── ...
```

**理由**:
- 用户目录是合理的默认位置
- 隐藏目录 `.vfs-workspace` 避免视觉干扰
- 参数传入支持自定义位置（如外部存储）

### Decision 4: VFS API Design

**选择**: RPC-style Native Messaging API

**API Methods**:
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

**理由**:
- RPC 风格便于 Extension 调用和错误处理
- 每个方法职责单一，便于实现和测试
- 分类队列管理通过独立 API（`enqueueClassification`, `getQueueStatus`）

### Decision 5: Extension Architecture

**选择**: Background Service Worker 作为中央协调器

**架构**:
```
Extension Background Service Worker:
├── NetworkInterceptor    # 捕获媒体请求
├── VFSClient            # Native Messaging 客户端
├── OllamaClient         # HTTP 客户端（调用本地 Ollama）
├── ClassifyScheduler    # 分类任务调度器
├── EventBroadcaster     # 向 DevTools Panel 广播事件
└── ConfigManager        # 配置管理

DevTools Panel:
├── React UI             # 展示媒体网格
├── chrome.runtime messaging # 接收 Background 事件
└── Settings Panel       # 用户配置
```

**理由**:
- Background Service Worker 是 Manifest V3 的标准模式
- 所有业务逻辑集中在 Background，便于状态管理
- DevTools Panel 作为纯 UI，通过 messaging 与 Background 通信

### Decision 6: Classification Queue Location

**选择**: VFS SQLite 的 `classify_queue` 表

**理由**:
- 与 `files` 表通过 hash 关联，便于原子操作
- 避免 chrome.storage.local 的容量限制（5MB）
- VFS 可以提供队列状态查询 API
- Extension 通过 VFS API 管理队列状态

## Risks / Trade-offs

### Risk 1: Native Messaging 安装复杂度

**风险**: 用户需要配置 Native Messaging Manifest 文件才能使用

**缓解**:
- 提供安装脚本自动配置
- 在 README 中提供详细的安装指南
- DevTools Panel 检测连接状态，提示未安装

### Risk 2: Native Host 单例模式

**风险**: 每个 Extension 只能有一个 Native Host 实例，多个 DevTools Panel 共享同一连接

**缓解**:
- Background Service Worker 作为中央协调器，管理所有连接
- 使用 chrome.runtime.connect 实现长连接
- DevTools Panel 通过 messaging 与 Background 通信，而非直接连接 Native Host

### Risk 3: Ollama 服务不可用

**风险**: Ollama 服务未启动或不可用时，分类功能失效

**缓解**:
- Extension 启动时检测 Ollama 健康状态
- DevTools Panel 显示 Ollama 状态提示
- 分类失败时保留原文件，仅标记为 `uncategorized`

### Risk 4: SQLite 数据丢失

**风险**: SQLite 文件损坏或误删导致元数据丢失

**缓解**:
- blob 文件独立存储，即使 SQLite 损坏也能恢复物理文件
- 提供 SQLite 备份 API（可选实现）
- 未来可考虑 WAL 模式提高可靠性

### Trade-off: 无法多客户端连接

**放弃的能力**: WebSocket 支持多个客户端同时连接

**接受理由**: Extension 是唯一客户端，无需多客户端支持。如果未来需要 CLI 工具，可以直接操作 SQLite 和 blob 文件。

## Migration Plan

### Phase 1: VFS Service 开发

1. 创建 `packages/vfs-service` 包
2. 实现 Native Messaging Host
3. 实现 SQLite 管理模块
4. 实现 Blob 存储模块
5. 单元测试和集成测试

### Phase 2: Extension 重构

1. 实现 Native Messaging Client
2. 将文件操作逻辑迁移到 Background
3. 将 AI 分类逻辑迁移到 Background
4. 重构 DevTools Panel（移除 WebSocket，改用 chrome.runtime messaging）
5. 移除 Proxy 相关代码

### Phase 3: 清理

1. 移除 `packages/proxy`
2. 移除 Proxy Plugin System
3. 移除 WebSocket 相关代码
4. 更新文档和安装指南

### Rollback Strategy

如果新架构存在问题，可以：
1. 保留旧的 Proxy Server 代码（git history）
2. Extension 可以临时切换回 WebSocket 模式（通过配置）
3. VFS Service 提供数据导出 API，可迁移到其他存储方案

## Open Questions

1. **ai-classify CLI 模式是否保留**: 已决策不保留 standalone CLI；AI 分类仅通过 Extension Background + VFS Service 路径提供。

2. **Thumbnail 生成位置**: Thumbnail 生成是否放在 VFS Service 还是 Extension？VFS 更接近存储层，但 Extension 可以调用更灵活的图像处理库。

3. **批量操作 API**: 是否需要批量保存、批量更新的 API？当前设计是单文件操作，可能影响性能。