## MODIFIED Requirements

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
