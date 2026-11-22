# Spec: VFS HTTP API

## Purpose

VFS HTTP Server 提供文件下载、缩略图、元数据、统计、健康检查和流式上传端点，供 extension 与本地客户端直接访问工作区媒体。
## Requirements
### Requirement: HTTP Server 端点
VFS Service 必须 (SHALL) 提供 HTTP Server 用于文件下载和缩略图获取。

#### Scenario: HTTP Server 端口
- **WHEN** VFS Service 启动
- **THEN** 系统必须 (SHALL) 在端口 8766 启动 HTTP Server
- **AND** 系统必须 (SHALL) 允许配置自定义端口

#### Scenario: CORS 配置
- **WHEN** Extension 请求 HTTP Server
- **THEN** 系统必须 (SHALL) 返回 CORS 头
- **AND** `Access-Control-Allow-Origin` 必须 (SHALL) 包含 `chrome-extension://*`

### Requirement: 文件下载端点
VFS Service 必须 (SHALL) 提供文件下载 HTTP 端点。

#### Scenario: 下载完整文件
- **WHEN** 客户端请求 `GET /files/:hash` 且没有 `Range` 头
- **THEN** 系统必须 (SHALL) 流式返回文件二进制内容
- **AND** 系统必须 (SHALL) 从磁盘读取并写入响应，不得把完整文件读入内存
- **AND** `Content-Type` 必须 (SHALL) 为文件的 MIME 类型
- **AND** `Content-Length` 必须 (SHALL) 为文件大小
- **AND** 系统必须 (SHALL) 返回 `Accept-Ranges: bytes`

#### Scenario: 文件不存在
- **WHEN** 客户端请求不存在的文件 hash
- **THEN** 系统必须 (SHALL) 返回 404 Not Found

#### Scenario: 文件下载缓存
- **WHEN** 客户端请求文件
- **THEN** 系统必须 (SHALL) 设置 `Cache-Control: max-age=3600`
- **AND** 系统必须 (SHALL) 返回稳定的 `ETag`（基于内容 hash）与 `Last-Modified`
- **AND** 当 `If-None-Match` 与当前 `ETag` 匹配时，系统必须 (SHALL) 返回 304 且不发送 body

#### Scenario: 单段 Range 请求
- **WHEN** 客户端发送合法的单段 `Range: bytes=start-end`
- **THEN** 系统必须 (SHALL) 返回 206 Partial Content
- **AND** 系统必须 (SHALL) 返回 `Content-Range: bytes start-end/size`
- **AND** `Content-Length` 必须 (SHALL) 为所请求区间的长度
- **AND** 响应 body 必须 (SHALL) 仅包含该区间的字节

#### Scenario: 无效或多段 Range 请求
- **WHEN** 客户端发送越界、格式非法或多段 `Range`
- **THEN** 系统必须 (SHALL) 返回 416 Range Not Satisfiable
- **AND** 系统必须 (SHALL) 返回 `Content-Range: bytes */size`
- **AND** 系统不得 (MUST NOT) 实现 multipart/byteranges

#### Scenario: HEAD 请求
- **WHEN** 客户端发送 `HEAD /files/:hash`
- **THEN** 系统必须 (SHALL) 返回与 GET 相同的响应头
- **AND** 系统不得 (MUST NOT) 发送响应 body

#### Scenario: 默认 inline 预览
- **WHEN** 客户端请求 `GET /files/:hash` 且没有 `?download=1`
- **THEN** 系统必须 (SHALL) 返回 `Content-Disposition: inline`
- **AND** 图片与视频预览 SHALL 可以直接使用该 URL

#### Scenario: 显式下载
- **WHEN** 客户端请求 `GET /files/:hash?download=1`
- **THEN** 系统必须 (SHALL) 返回 `Content-Disposition: attachment`
- **AND** 当文件存在 `ai_filename` 时，文件名必须 (SHALL) 为 `<ai_filename>.<ext>`
- **AND** 当文件没有 `ai_filename` 时，文件名必须 (SHALL) 回退为 `<hash>.<ext>`
- **AND** 扩展名必须 (SHALL) 来自存储的 MIME 类型或 blob 扩展名

#### Scenario: 文件名合法化
- **WHEN** `ai_filename` 包含路径分隔符、控制字符、首尾点或空格、Windows 保留名，或超过长度上限
- **THEN** 系统必须 (SHALL) 在写入响应头前清理文件名
- **AND** 系统必须 (SHALL) 同时提供 ASCII 回退名
- **AND** 不得将未转义的文件名直接拼入响应头

#### Scenario: 下载响应头安全
- **WHEN** 系统返回文件下载响应
- **THEN** 系统应该 (SHOULD) 设置 `X-Content-Type-Options: nosniff`
- **AND** `Content-Disposition` 中的非 ASCII 文件名应该 (SHOULD) 使用 RFC 5987 的 `filename*` 形式

#### Scenario: 客户端提前断开
- **WHEN** 客户端在流式响应完成前断开连接
- **THEN** 系统必须 (SHALL) 销毁文件读取流并释放资源
- **AND** 系统不得 (MUST NOT) 将主动断开记录为服务器错误

### Requirement: 缩略图端点
VFS Service 必须 (SHALL) 提供缩略图 HTTP 端点。

#### Scenario: 获取缩略图
- **WHEN** 客户端请求 `GET /files/:hash/thumbnail`
- **THEN** 系统必须 (SHALL) 返回缩略图二进制内容
- **AND** `Content-Type` 必须 (SHALL) 为 `image/jpeg`
- **AND** 系统必须 (SHALL) 支持查询参数 `?size=small|medium|large`

#### Scenario: 缩略图尺寸
- **WHEN** 客户端指定缩略图尺寸
- **THEN** 系统必须 (SHALL) 返回对应尺寸的缩略图
- **AND** `small` 必须 (SHALL) 为 100x100 像素
- **AND** `medium` 必须 (SHALL) 为 200x200 像素
- **AND** `large` 必须 (SHALL) 为 400x400 像素

#### Scenario: 缩略图不存在
- **WHEN** 文件不存在或无法生成缩略图
- **THEN** 系统必须 (SHALL) 返回 404 Not Found

### Requirement: 元数据端点
VFS Service 必须 (SHALL) 提供元数据 HTTP 端点。

#### Scenario: 获取文件元数据
- **WHEN** 客户端请求 `GET /files/:hash/metadata`
- **THEN** 系统必须 (SHALL) 返回 JSON 格式的元数据
- **AND** `Content-Type` 必须 (SHALL) 为 `application/json`

#### Scenario: 元数据内容
- **WHEN** 返回文件元数据
- **THEN** 系统必须 (SHALL) 包含以下字段：
  - `hash`: 文件哈希
  - `mimeType`: MIME 类型
  - `size`: 文件大小
  - `category`: 分类
  - `aiFilename`: AI 建议的文件名
  - `capturedAt`: 捕获时间
  - `classifiedAt`: 分类时间
  - `confidence`: 置信度

### Requirement: 统计端点
VFS Service 必须 (SHALL) 提供统计信息 HTTP 端点。

#### Scenario: 获取统计信息
- **WHEN** 客户端请求 `GET /stats`
- **THEN** 系统必须 (SHALL) 返回 JSON 格式的统计信息
- **AND** 系统必须 (SHALL) 包含：
  - `totalFiles`: 文件总数
  - `totalSize`: 总大小（字节）
  - `images`: 图片数量
  - `videos`: 视频数量
  - `byCategory`: 各分类数量

### Requirement: 服务状态端点
VFS Service 必须 (SHALL) 提供服务状态 HTTP 端点。

#### Scenario: 健康检查
- **WHEN** 客户端请求 `GET /health`
- **THEN** 系统必须 (SHALL) 返回 200 OK
- **AND** 系统必须 (SHALL) 返回 `{ "status": "ok", "version": "<version>" }`

#### Scenario: 服务信息
- **WHEN** 客户端请求 `GET /`
- **THEN** 系统必须 (SHALL) 返回服务信息
- **AND** 系统必须 (SHALL) 包含：
  - `name`: 服务名称
  - `version`: 版本号
  - `websocketPort`: WebSocket 端口
  - `workspacePath`: 工作空间路径

### Requirement: Streaming upload endpoint

The VFS HTTP server SHALL expose a `POST /upload` endpoint that streams a raw request body into the workspace without buffering the complete file in service memory.

#### Scenario: Upload media
- **WHEN** a client sends `POST /upload` with a raw body, a supported `Content-Type`, a valid `X-Source-Url` header, and an optional `X-Captured-At` header
- **THEN** the server streams the body to a temporary file while computing its SHA-256 hash
- **AND** on completion the server stores the blob as `{hash}.{ext}` using the MIME type mapping
- **AND** the server inserts file metadata with the matching system tag (`system:image` or `system:video`)
- **AND** the server responds `200` with JSON containing `hash`, `duplicate: false`, `size`, and `mimeType`

#### Scenario: Upload an image
- **WHEN** a client sends `POST /upload` with an `image/*` `Content-Type` and a non-empty body
- **THEN** the server SHALL store it through the same streamed path used for videos
- **AND** the stored metadata SHALL include `system:image`
- **AND** the response shape SHALL be identical to a video upload

#### Scenario: Duplicate content
- **WHEN** the uploaded content hash already exists in the metadata database
- **THEN** the server discards the temporary file
- **AND** the server responds `200` with JSON containing `hash`, `duplicate: true`, and `size`
- **AND** the server does not create another metadata row

#### Scenario: Size limit exceeded
- **WHEN** the received byte count exceeds the configured maximum upload size
- **THEN** the server stops reading the request, deletes the temporary file, and responds `413 Payload Too Large`
- **AND** no metadata row is created

#### Scenario: Unsupported MIME type
- **WHEN** the `Content-Type` header is missing or is not `image/*` or `video/*`
- **THEN** the server responds `400 Bad Request` or `415 Unsupported Media Type` respectively
- **AND** no temporary file is retained

#### Scenario: Interrupted upload
- **WHEN** the client aborts the request before it completes
- **THEN** the server deletes the temporary file
- **AND** no metadata row is created

#### Scenario: Upload CORS preflight
- **WHEN** a client sends `OPTIONS /upload`
- **THEN** the server responds `204` with `Access-Control-Allow-Methods` including `POST` and `Access-Control-Allow-Headers` including `Content-Type`, `X-Source-Url`, and `X-Captured-At`

### Requirement: Uploaded file metadata

The upload endpoint SHALL record the same metadata fields as the existing `saveFile` operation.

#### Scenario: Metadata recorded
- **WHEN** an upload is stored
- **THEN** the stored metadata includes the content hash, blob extension, MIME type, size, source URL, capture time, and system tag
- **AND** the file is immediately visible to the existing file listing and statistics endpoints

#### Scenario: Thumbnail available after upload
- **WHEN** a stored upload is a video
- **THEN** the existing thumbnail endpoint serves a first-frame thumbnail generated from the stored blob

### Requirement: Assembly job endpoints

VFS Service 必须 (SHALL) 提供内部 HTTP 端点，用于在入库前按字节偏移接收并组装缓冲视频。

所有 assembly 端点必须 (SHALL) 仅监听 localhost，并要求建 job 时签发的一次性 token。

#### Scenario: 创建 assembly job
- **WHEN** 客户端发送 `POST /assemblies`，请求体包含 `totalSize`、`mimeType`、`sourceUrl`、`pageUrl` 和 `capturedAt`
- **THEN** 服务必须 (SHALL) 校验 MIME 类型为受支持的 `video/*`
- **AND** 服务必须 (SHALL) 校验 `totalSize` 不超过配置的上传上限
- **AND** 服务必须 (SHALL) 在 `workspace/tmp/assemblies/` 下创建以随机 job id 命名的临时文件
- **AND** 服务必须 (SHALL) 返回 `jobId` 和一次性 `token`

#### Scenario: 创建请求非法
- **WHEN** 创建请求缺少 `totalSize`、MIME 类型不受支持、或 `totalSize` 超过上限
- **THEN** 服务必须 (SHALL) 返回 `400`、`415` 或 `413`
- **AND** 服务不得 (MUST NOT) 保留临时文件

#### Scenario: 按偏移写入 chunk
- **WHEN** 客户端发送 `PUT /assemblies/:jobId/chunks?offset=N`，携带有效 token 和 `Content-Type: application/octet-stream`
- **THEN** 服务必须 (SHALL) 将该请求体写入临时文件的 `N` 偏移处
- **AND** 服务必须 (SHALL) 记录已写入的字节区间
- **AND** 服务必须 (SHALL) 返回 `204 No Content`

#### Scenario: 写入越界
- **WHEN** `offset` 为负、`offset + bodyLength` 超过 `totalSize`，或 body 为空
- **THEN** 服务必须 (SHALL) 拒绝写入并返回 `400` 或 `413`
- **AND** 服务必须 (SHALL) 保持已记录区间不变

#### Scenario: token 或 job 无效
- **WHEN** 请求携带缺失或错误的 token，或 `jobId` 不存在
- **THEN** 服务必须 (SHALL) 返回 `403` 或 `404`
- **AND** 服务不得 (MUST NOT) 写入任何字节

#### Scenario: 完成组装
- **WHEN** 客户端发送 `POST /assemblies/:jobId/complete`，携带有效 token
- **THEN** 服务必须 (SHALL) 校验已记录区间的并集覆盖 `[0, totalSize)`
- **AND** 覆盖完整时，服务必须 (SHALL) 将临时文件以流式方式交给 `saveFileFromStream`
- **AND** 服务必须 (SHALL) 返回包含 `hash`、`duplicate`、`size` 和 `mimeType` 的 JSON
- **AND** 服务必须 (SHALL) 在完成或失败后删除临时文件

#### Scenario: 覆盖不完整时拒绝完成
- **WHEN** 已记录区间存在空洞
- **THEN** 服务必须 (SHALL) 返回 `409 Conflict`
- **AND** 响应必须 (SHALL) 包含缺失字节数
- **AND** 服务不得 (MUST NOT) 创建文件元数据

#### Scenario: 放弃组装
- **WHEN** 客户端发送 `DELETE /assemblies/:jobId`，或会话停止、标签页关闭、页面导航触发放弃
- **THEN** 服务必须 (SHALL) 删除临时文件并释放 job
- **AND** 服务必须 (SHALL) 返回 `204 No Content`

#### Scenario: 不活动 job 过期
- **WHEN** 一个 assembly job 超过配置的不活动超时时间没有写入
- **THEN** 服务必须 (SHALL) 自动放弃该 job 并删除临时文件

#### Scenario: 并发 job 上限
- **WHEN** 活跃 assembly job 数量达到配置上限
- **THEN** 服务必须 (SHALL) 拒绝创建新 job
- **AND** 错误响应必须 (SHALL) 标明资源限制原因

#### Scenario: 启动时清理残留
- **WHEN** VFS Service 启动
- **THEN** 服务必须 (SHALL) 删除超过保留时限的 assembly 临时文件

#### Scenario: Web 页面不可直接调用
- **WHEN** 一个普通网页尝试调用 assembly 端点
- **THEN** 服务不得 (MUST NOT) 为该来源授予 CORS 访问
- **AND** 缺少一次性 token 的请求必须 (SHALL) 被拒绝
