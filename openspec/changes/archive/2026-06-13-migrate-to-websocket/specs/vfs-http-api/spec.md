## ADDED Requirements

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
- **WHEN** 客户端请求 `GET /files/:hash`
- **THEN** 系统必须 (SHALL) 返回文件二进制内容
- **AND** `Content-Type` 必须 (SHALL) 为文件的 MIME 类型
- **AND** `Content-Length` 必须 (SHALL) 为文件大小

#### Scenario: 文件不存在
- **WHEN** 客户端请求不存在的文件 hash
- **THEN** 系统必须 (SHALL) 返回 404 Not Found

#### Scenario: 文件下载缓存
- **WHEN** 客户端请求文件
- **THEN** 系统应该 (SHOULD) 设置缓存头
- **AND** `Cache-Control` 应该 (SHOULD) 为 `max-age=3600`

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