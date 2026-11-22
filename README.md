# Chrome Media Recorder

一个专为 Chrome 浏览器设计的媒体自动捕获系统，使用 Chrome Side Panel 控制捕获，并通过 Background Service Worker 的 debugger/CDP Network 后端拦截网页图片，通过 WebSocket + HTTP 双通道架构保存到本地文件系统。

## 项目简介

本项目能够自动捕获和保存用户浏览网页时看到的图片和视频，无需手动保存每个文件。系统集成了 AI 分类功能，自动对捕获的媒体文件进行智能分类和命名。

### 核心特性

- **Chrome 专属**: 支持 Chrome 88+，使用 Manifest V3、Side Panel API 和 debugger/CDP Network API
- **WebSocket + HTTP 双通道**: WebSocket 用于实时通信和事件推送，HTTP 用于流式上传、文件下载和缩略图获取
- **Side Panel + Options 分工**: Side Panel 是当前标签页的捕获驾驶舱，Options 是全局媒体库与控制台
- **一次性捕获**: 右键图片直接保存，或在侧栏「抓取本页媒体」扫描页面后预览、多选、批量保存；不需要 debugger，也不会创建捕获会话
- **智能去重**: 基于 SHA-256 内容哈希，自动防止重复保存
- **检索与批量**: 媒体库支持文本搜索、类型/站点/时间/标签/分类状态筛选、排序，以及多选批量移入回收站、重新入队和导出
- **可读导出**: 单文件下载与 zip 导出使用 AI 文件名；zip 内附 `metadata.json`，保留来源、标签、备注和分类信息
- **多格式支持**: 图片（JPEG、PNG、WebP、GIF、BMP）和视频（MP4、WebM、MOV、AVI）
- **AI 分类**: 集成 Ollama，使用视觉模型自动分类和命名文件

## 项目结构

```
chrome-history-recorder/
├── packages/
│   ├── extension/          # Chrome 扩展（薄 UX 层）→ [详细说明](packages/extension/README.md)
│   ├── app/                # 长驻后端：启动、调度、配置、事件总线
│   ├── ai/                 # Ollama 分类 / 重命名 / 健康 / 模型
│   └── vfs/                # 存储与传输（VFSAPI、SQLite/blob、WS/HTTP）
├── openspec/               # 项目规划和规范文档
├── package.json            # Monorepo 根配置
└── pnpm-workspace.yaml     # pnpm 工作区配置
```

## 架构说明

本项目使用 **WebSocket + HTTP 双通道**架构：

1. **WebSocket Server (端口 8765)**: 用于 API 调用和实时事件推送
   - 文件操作 API（保存、回收站、恢复、永久删除、列表）
   - 分类队列管理
   - 实时事件广播（文件捕获、移入回收站、恢复、永久删除、分类完成）

2. **HTTP Server (端口 8766)**: 用于流式上传、文件下载和缩略图获取
   - 流式上传 (`POST /upload`，图片与视频共用)
   - 文件流式下载 (`GET /files/:hash`，支持 Range/inline；`?download=1` 下载)
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

# 构建后端（vfs → ai → app）
pnpm build:app

# 构建 Extension
pnpm --filter extension build
```

### 启动后端 App

app 需要在 Extension 加载前启动（它负责 WebSocket + HTTP 服务、任务调度和配置）：

```bash
# 启动 app（WebSocket + HTTP Server + 调度器）
pnpm --filter app start

# 或使用开发模式（同时启动 app 与 extension）
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
2. 在任意网页点击扩展图标打开 Chrome 右侧 Side Panel
3. 查看当前标签页身份和 VFS 连接状态（绿色 ● 表示已连接）
4. 点击「开始捕获」开始捕获当前标签页；全局同时只允许一个捕获会话
5. 捕获的图片将自动保存到 `~/.vfs-workspace/`
6. 在 Options 控制台的「媒体库」中浏览和管理全局媒体

媒体库顶部提供搜索、类型/来源站点/时间/标签/分类状态筛选和排序。点击「选择」进入多选模式后，可以批量移入回收站、重新排队 AI 分类/命名，或把选中的原图导出为 zip；导出目录内会附带 `metadata.json`。单文件下载通过 `?download=1` 请求 attachment，并优先使用 AI 文件名和真实扩展名。

Side Panel 只显示当前会话的媒体流和诊断日志；全局历史瀑布流、标签治理、AI 配置和任务队列都在 Options 控制台。切换到其他标签页时，Side Panel 会显示「另一个标签页正在捕获」横幅，并提供切换或停止会话的操作。

在媒体库中删除媒体会将条目移入 Options 控制台的「回收站」，原始文件、缩略图和归档副本都会保留，可随时恢复；只有执行「永久删除」或「清空回收站」才会释放磁盘并移除归档副本。

捕获启用时，Chrome 会授予扩展 `debugger` 权限并可能显示当前标签页正在被调试的提示。这是 Side Panel 模式下读取图片响应体所需的 Chrome 能力；点击「停止捕获」会释放该标签页的 debugger 会话。

不想开启捕获会话时，可以直接在页面上右键图片选择「保存图片到媒体库」，或在 Side Panel 右上角点击「抓取本页媒体」图标扫描当前页面。扫描结果会先进入预览，你可以全选、取消或只保存一部分。一次性保存复用同一套入库、去重、AI 和归档链路，但不会创建或修改捕获会话，也不会进入会话计数和会话 feed。

持续捕获会话聚焦网络图片响应：不还原 Canvas/WebGL 生成的 `data:` 图片或页面内组装的 `blob:` 图片，也不承诺还原复杂视频流、Range 分片或 MSE 播放内容。一次性捕获会尝试保存页面中已经存在的 `data:` / `blob:` 图片（受页面 CSP、blob 生命周期和跨域限制），但不扫描 canvas 像素本身。

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

AI 分类会在捕获文件后加入本地 VFS 分类队列。扩展 Options 控制台（「设置」和「任务」标签）可以从本地 Ollama `/api/tags` 查询已安装模型，并通过下拉框选择用于后续任务的视觉模型；模型选择会立即保存，刷新模型列表不会覆盖当前选择。AI 分类默认暂停，任务标签提供开始/暂停控制；暂停只会停止领取新的待处理任务，已经处理中的任务会自然完成或失败。

AI 只能处理能产出代表性图像的媒体（视觉模型原生格式，或缩略图解码器可读取的格式，以及视频）。无法处理的格式（例如 ICO/BMP 图标）仍会被捕获和归档，但 AI 任务会以 `skipped` 终态记录并显示原因，不会反复重试；启动时也会把历史上这类 `pending`/`failed` 任务对账为 `skipped`。

这里的“重命名”指更新 VFS 元数据中的 `ai_filename` 智能文件名，不会物理重命名、移动、导出或删除 hash 存储的原始 blob 文件。用户也可以在媒体详情或卡片快捷操作中将单个图片/视频重新加入分类与智能命名队列。

## 子模块文档

| 模块      | 说明                                                          | 文档                                      |
| --------- | ------------------------------------------------------------- | ----------------------------------------- |
| extension | Chrome 扩展：Side Panel 捕获驾驶舱、Options 控制台与 CDP 捕获 | [README.md](packages/extension/README.md) |
| app       | 长驻后端：启动、任务调度、配置真源、事件总线                  | `packages/app/`                           |
| ai        | Ollama 分类 / 重命名 / 健康 / 模型                            | `packages/ai/`                            |
| vfs       | 存储与传输（VFSAPI、SQLite/blob、WS/HTTP）                    | `packages/vfs/`                           |

## VFS Service 端点

### WebSocket API (ws://localhost:8765)

支持的 API 方法：

- `saveFile`: 保存文件（兼容路径；扩展捕获已改走 `POST /upload`）
- `getFile`: 获取文件
- `trashFile`: 移入回收站
- `restoreFile`: 从回收站恢复
- `restoreAll`: 恢复回收站中的全部文件
- `purgeFile`: 永久删除单个文件
- `emptyTrash`: 清空回收站
- `listFiles`: 列出文件（`status`: `active` / `trashed` / `all`）
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

| 端点                          | 说明                                        |
| ----------------------------- | ------------------------------------------- |
| `POST /upload`                | 流式上传媒体（图片/视频）                   |
| `GET /files/:hash`            | 流式读取文件；支持单段 `Range`，默认 inline |
| `GET /files/:hash?download=1` | 以 attachment 下载（AI 文件名）             |
| `GET /files/:hash/thumbnail`  | 获取缩略图（支持 ?size=small/medium/large） |
| `GET /files/:hash/metadata`   | 获取文件元数据                              |
| `GET /stats`                  | 获取统计信息                                |
| `GET /health`                 | 健康检查                                    |
| `GET /`                       | 服务信息                                    |

### 实时事件

WebSocket 会广播以下事件：

- `vfs:connected`: VFS 连接确认
- `vfs:disconnected`: VFS 断开通知
- `file:captured`: 文件捕获完成
- `file:trashed`: 文件移入回收站
- `file:restored`: 文件从回收站恢复（含重复采集自动恢复）
- `file:purged`: 文件被永久删除
- `trash:emptied`: 回收站清空完成
- `trash:restored-all`: 回收站全部恢复完成
- `classify:queued`: AI 分类任务已入队
- `classify:started`: AI 分类任务开始处理
- `classify:complete`: AI 分类任务处理完成
- `classify:failed`: AI 分类任务处理失败
- `classify:skipped`: AI 分类跳过（媒体格式不适用，不会重试）
- `classify:scheduler`: AI 分类调度器运行/暂停状态变化
- `task:skipped`: 任务终态跳过（分类或重命名）
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
pnpm --filter app dev                # 监听 app 代码变化
pnpm --filter app dev:start          # 启动 app
```

### 测试

```bash
# 运行后端测试
pnpm --filter vfs test
pnpm --filter ai test
pnpm --filter app test

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
pnpm --filter vfs build
pnpm --filter ai build
pnpm --filter app build
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

可以通过启动参数、环境变量或扩展 Options 页面修改工作空间路径。AI 分类配置通过扩展 Options 页面管理。

### 路径来源与优先级

工作区路径按以下顺序解析，先命中者生效：

1. 启动参数 `--workspace` / `-w`
2. 环境变量 `VFS_WORKSPACE`
3. Options「设置 → 存储与工作空间」保存的路径（用户级 launcher 配置）
4. 默认路径 `~/.vfs-workspace`

```bash
# 环境变量（对 pnpm dev 同样生效）
VFS_WORKSPACE=/Volumes/Media/vfs-workspace pnpm dev

# 启动参数
pnpm --filter app start -- --workspace /Volumes/Media/vfs-workspace
```

### 在 Options 中修改

打开扩展 Options →「设置」→「存储与工作空间」，输入绝对路径并保存。**重启后端进程后才会切换**（开发模式下按 Ctrl+C 终止后重新运行 `pnpm dev`）；重启前捕获的内容仍写入原路径。卡片会显示当前路径、路径来源和待生效路径。

- 目标目录必须不存在、为空，或包含 `vfs.db` 的已有工作区；非空且没有 `vfs.db` 的目录会被拒绝。
- 切换路径**不会移动、复制或删除**旧工作区的数据，旧目录原地保留。
- 新空工作区会按默认配置初始化（AI 分类默认暂停），旧工作区的 `config.json` 仍然保留；切回旧路径即可恢复原配置。
- 通过 `--workspace` / `VFS_WORKSPACE` 指定的路径优先于 Options，此时 Options 中的编辑控件为只读。

Launcher 配置文件位于工作区之外：

```
macOS    ~/Library/Application Support/browser-media-recorder/config.json
Linux    $XDG_CONFIG_HOME/browser-media-recorder/config.json（缺省 ~/.config/...）
Windows  %APPDATA%\browser-media-recorder\config.json
```

### 外置盘、网络共享与启动失败

保存路径和每次启动都会校验目标（父目录存在且可写、外置卷已挂载等）。如果配置的工作区在启动时不可用（例如外置盘未挂载），后端会**失败退出**并打印原因、配置来源和恢复方式，不会自动回退到默认路径。恢复方式：

1. 挂载对应磁盘后重新启动；
2. 使用 `--workspace <path>` 临时指定其他工作区；
3. 删除 launcher 配置中的 `workspacePath` 字段（或整个文件），回到默认 `~/.vfs-workspace`。

> **网络共享（SMB / NFS）不支持 SQLite WAL。** 新建的工作区在无法启用 WAL 时会自动退回 rollback journal（`delete`）模式，日志会打印一条警告，功能不受影响。但**已在 WAL 模式下创建或复制过来的 `vfs.db` 在该类卷上无法打开**，启动会失败并提示：把 `vfs.db` 复制到本地磁盘，执行 `PRAGMA journal_mode = DELETE;`，再复制回去。

### 媒体归档（本地工作区 → NAS）

推荐把工作区保留在本地，用「媒体归档」把新增媒体复制到 NAS 挂载目录，而不是把整个工作区或 `blobs/` 放到 SMB 上：SQLite 需要本地 WAL，而跨文件系统的 `rename` 会让视频上传失败。

打开扩展 Options →「任务」→「媒体归档」：

- 设置启用开关、目标目录和对账间隔（1–1440 分钟，默认 5 分钟）。
- 卡片展示整体进度：已完成/总数、进度条、处理中/待处理/失败任务数。
- 每个新增文件是一条「媒体归档」任务；归档由独立 runner 消费，分类暂停或 Ollama 不可用时照常运行。
- 目标必须是**已存在**的绝对目录；NAS 需先挂载，应用不会自动创建目录，也不会在未挂载的挂载点写入本地文件。
- 只归档**首次启用之后**新增的媒体；停用后重新启用会补上停用期间的新增，但启用前的存量永远不会自动归档。
- 目标文件使用内容哈希命名 `<hash>.<ext>`，扁平存放；不复制缩略图、AI 元数据或 sidecar。移入回收站不会改动归档副本；永久删除媒体时会同时移除当前归档目标中的对应副本。
- 更换目标目录时，会重建启用以来的归档任务，把新目标中缺失的文件补齐。
- 复制先写入目标目录内的 `.<hash>.<ext>.part` 再 `rename`，避免出现半截文件；单个文件失败会留在任务队列中无限重试（指数退避，上限 1 小时），不会阻塞后续文件。

状态文件 `~/.vfs-workspace/media-archive-state.json` 只保存启用基线、对账游标和换目标标记；逐文件的进度与失败在任务表中。归档失败不会阻止后端启动；设置卡片会显示上次运行时间、待处理/失败任务数和最后错误。

> 如果 launcher 配置或 `--workspace` 仍指向 NAS 工作区，请先按上一节切回本地 `~/.vfs-workspace`。

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
