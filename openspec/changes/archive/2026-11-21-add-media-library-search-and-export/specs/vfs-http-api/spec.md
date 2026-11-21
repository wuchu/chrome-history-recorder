## MODIFIED Requirements

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

#### Scenario: 使用 AI 文件名下载
- **WHEN** 客户端请求 `GET /files/:hash` 且该文件存在 `ai_filename`
- **THEN** 系统必须 (SHALL) 设置 `Content-Disposition: attachment`
- **AND** 文件名必须 (SHALL) 为 `<ai_filename>.<ext>`
- **AND** 扩展名必须 (SHALL) 来自存储的 MIME 类型或 blob 扩展名

#### Scenario: 没有 AI 文件名
- **WHEN** 文件没有 `ai_filename`
- **THEN** 下载文件名必须 (SHALL) 回退为 `<hash>.<ext>`

#### Scenario: 文件名合法化
- **WHEN** `ai_filename` 包含路径分隔符、控制字符、首尾点或空格、Windows 保留名，或超过长度上限
- **THEN** 系统必须 (SHALL) 在写入响应头前清理文件名
- **AND** 系统必须 (SHALL) 同时提供 ASCII 回退名
- **AND** 不得将未转义的文件名直接拼入响应头

#### Scenario: 下载响应头安全
- **WHEN** 系统返回文件下载响应
- **THEN** 系统应该 (SHOULD) 设置 `X-Content-Type-Options: nosniff`
- **AND** `Content-Disposition` 中的非 ASCII 文件名应该 (SHOULD) 使用 RFC 5987 的 `filename*` 形式
