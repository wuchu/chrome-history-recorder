## MODIFIED Requirements

### Requirement: 图片存储 API
代理服务必须 (SHALL) 提供用于存储和检索媒体文件（图片和视频）的 HTTP API。

#### Scenario: 接收媒体数据
- **WHEN** 在 `/save-image` 接收到 POST 请求
- **THEN** 服务必须 (SHALL) 接收包含 `url`、`mimeType`、`data` 字段的 JSON 数据
- **AND** 服务必须 (SHALL) 配置足够大的 body 解析限制（如 100MB）以处理大尺寸图片和视频

#### Scenario: 解码 base64 数据
- **WHEN** 接收到的 `data` 字段可能包含 data URL 格式或纯 base64
- **THEN** 服务必须 (SHALL) 正确处理两种格式：
  - 如果包含 `,` 分隔符，提取逗号后的 base64 部分
  - 否则直接使用原始数据作为 base64

#### Scenario: 生成唯一文件名
- **WHEN** 需要保存媒体文件
- **THEN** 服务必须 (SHALL) 使用内容哈希作为文件名
- **AND** 文件名格式必须 (SHALL) 为：`<hash>.<ext>`（哈希为 SHA-256 截断至 16 字符）
- **AND** 扩展名必须 (SHALL) 从 MIME 类型提取

#### Scenario: 从 MIME 类型提取扩展名
- **WHEN** MIME 类型为 `image/jpeg`、`video/mp4` 等
- **THEN** 服务必须 (SHALL) 根据标准 MIME 类型映射提取扩展名

**标准 MIME 类型到扩展名映射表（新增视频）**:
| MIME 类型 | 标准扩展名 | 说明 |
|-----------|-----------|------|
| `image/jpeg` | `.jpg` | JPEG/JPG 图片 |
| `image/png` | `.png` | PNG 图片 |
| `image/gif` | `.gif` | GIF 动画图片 |
| `image/webp` | `.webp` | WebP 现代格式 |
| `video/mp4` | `.mp4` | MP4 视频（最常见） |
| `video/webm` | `.webm` | WebM 视频 |
| `video/quicktime` | `.mov` | QuickTime/MOV 视频 |
| `video/x-msvideo` | `.avi` | AVI 视频 |
| `video/ogg` | `.ogv` | Ogg 视频 |

## ADDED Requirements

### Requirement: 大文件传输支持
代理服务必须 (SHALL) 支持大文件（如视频）的传输和存储。

#### Scenario: 接收大尺寸视频
- **WHEN** 接收到超过 50MB 的视频数据
- **THEN** 服务必须 (SHALL) 正确处理和存储
- **AND** 服务必须 (SHALL) 不因文件大小限制而拒绝请求

#### Scenario: 内存优化处理
- **WHEN** 处理大文件上传
- **THEN** 服务可以 (MAY) 使用流式处理减少内存占用

### Requirement: 视频格式识别
代理服务必须 (SHALL) 正确识别和存储各种视频格式。

#### Scenario: MP4 视频存储
- **WHEN** 接收到 `video/mp4` MIME 类型
- **THEN** 服务必须 (SHALL) 使用 `.mp4` 扩展名存储

#### Scenario: WebM 视频存储
- **WHEN** 接收到 `video/webm` MIME 类型
- **THEN** 服务必须 (SHALL) 使用 `.webm` 扩展名存储

#### Scenario: 未知视频格式处理
- **WHEN** 接收到不在映射表中的视频 MIME 类型
- **THEN** 服务必须 (SHALL) 使用 `.bin` 作为扩展名