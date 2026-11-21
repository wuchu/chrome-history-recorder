# Thumbnail Generation

## Purpose

Provide thumbnail generation, sizing, caching, and retrieval for captured media through the VFS HTTP API.

## Requirements

### Requirement: 缩略图生成 API
Proxy 服务必须 (SHALL) 提供缩略图生成和检索 API。

#### Scenario: 请求缩略图
- **WHEN** GET `/images/:hash/thumbnail` 请求
- **THEN** 系统必须 (SHALL) 返回指定文件的缩略图
- **AND** 系统必须 (SHALL) 支持可选 `size` 参数指定缩略图尺寸
- **AND** 默认尺寸应该 (SHOULD) 为 100px

#### Scenario: 图片缩略图生成
- **WHEN** 请求图片缩略图
- **THEN** 系统必须 (SHALL) 使用图像处理库生成缩略图
- **AND** 系统必须 (SHALL) 保持宽高比例
- **AND** 系统必须 (SHALL) 使用 WebP 或 JPEG 格式输出
- **AND** 输出质量应该 (SHOULD) 为 80%

#### Scenario: 视频缩略图生成
- **WHEN** 请求视频缩略图
- **THEN** 系统必须 (SHALL) 使用 FFmpeg 提取第一帧
- **AND** 系统必须 (SHALL) 按指定尺寸缩放帧
- **AND** 系统必须 (SHALL) 以图片格式返回

#### Scenario: 缩略图缓存
- **WHEN** 缩略图首次生成
- **THEN** 系统应该 (SHOULD) 缓存生成的缩略图
- **AND** 缓存位置应该 (SHOULD) 在存储目录的 `.thumbnails/` 子目录
- **AND** 缓存文件名应该 (SHOULD) 为 `<hash>_<size>.webp`

#### Scenario: 缓存命中
- **WHEN** 请求已缓存的缩略图
- **THEN** 系统必须 (SHALL) 直接返回缓存的文件
- **AND** 系统必须 (SHALL) 不重新生成

#### Scenario: 缩略图不存在
- **WHEN** 请求不存在的哈希的缩略图
- **THEN** 系统必须 (SHALL) 返回 404 Not Found

#### Scenario: FFmpeg 不可用
- **WHEN** 请求视频缩略图但 FFmpeg 未安装
- **THEN** 系统必须 (SHALL) 返回错误响应
- **AND** 错误信息必须 (SHALL) 提示安装 FFmpeg

### Requirement: 缩略图尺寸支持
Proxy 服务必须 (SHALL) 支持多种缩略图尺寸。

#### Scenario: 小尺寸缩略图
- **WHEN** size 参数为 small 或 100
- **THEN** 系统必须 (SHALL) 生成 100px 宽度的缩略图

#### Scenario: 中尺寸缩略图
- **WHEN** size 参数为 medium 或 200
- **THEN** 系统必须 (SHALL) 生成 200px 宽度的缩略图

#### Scenario: 大尺寸缩略图
- **WHEN** size 参数为 large 或 400
- **THEN** 系统必须 (SHALL) 生成 400px 宽度的缩略图

#### Scenario: 自定义尺寸
- **WHEN** size 参数为任意数字
- **THEN** 系统必须 (SHALL) 生成指定宽度的缩略图
- **AND** 最大尺寸应该 (SHOULD) 限制为 800px

### Requirement: 缩略图响应格式
Proxy 服务必须 (SHALL) 返回正确格式的缩略图响应。

#### Scenario: 返回图片文件
- **WHEN** 缩略图生成成功
- **THEN** 系统必须 (SHALL) 返回图片二进制数据
- **AND** 系统 必须 (SHALL) 设置正确的 Content-Type 头
- **AND** 系统必须 (SHALL) 设置 Content-Length 头

#### Scenario: 响应头缓存控制
- **WHEN** 返回缓存的缩略图
- **THEN** 系统应该 (SHOULD) 设置 Cache-Control 头
- **AND** 缓存时间应该 (SHOULD) 为 24 小时以上

#### Scenario: ETag 支持
- **WHEN** 返回缩略图
- **THEN** 系统应该 (SHOULD) 设置 ETag 头
- **AND** ETag 应该 (SHOULD) 基于文件哈希和尺寸

### Requirement: 批量缩略图 API
Proxy 服务应该 (SHOULD) 支持批量获取缩略图 URL。

#### Scenario: 文件列表包含缩略图 URL
- **WHEN** GET `/images` 请求包含 `includeThumbnails=true` 参数
- **THEN** 系统应该 (SHOULD) 在每个文件项中包含 thumbnailUrl 字段
- **AND** thumbnailUrl 应该 (SHOULD) 为相对路径

#### Scenario: 多尺寸缩略图 URL
- **WHEN** GET `/images` 请求包含 `thumbnailSizes=small,medium` 参数
- **THEN** 系统可以 (MAY) 返回多个尺寸的缩略图 URL

### Requirement: 解码能力查询

缩略图子系统必须 (SHALL) 提供其捆绑解码器当前实际可读取的图片 MIME 类型集合，供 AI 媒体资格判定使用。

#### Scenario: 查询可解码的图片 MIME 类型
- **WHEN** 其他子系统查询图片解码能力
- **THEN** 系统必须 (SHALL) 返回当前捆绑的 sharp/libvips 构建支持输入解码的图片 MIME 类型
- **AND** 集合必须 (SHALL) 由实际解码器能力推导，而不是硬编码常量
- **AND** 当前构建无法解码的格式（例如 ICO、BMP）必须 (SHALL) 不出现在集合中

#### Scenario: 格式能力与 MIME 类型映射
- **WHEN** 子系统请求解码能力
- **THEN** 系统必须 (SHALL) 将解码器格式标识映射为对应 MIME 类型
- **AND** 无法映射为图片 MIME 类型的格式必须 (SHALL) 被排除

#### Scenario: 解码能力用于资格预检
- **WHEN** AI 子系统判定某个图片能否通过缩略图获得代表性图像
- **THEN** 它必须 (SHALL) 使用该解码能力集合
- **AND** 不在集合中的格式必须 (SHALL) 被判定为不可处理，而不是在调用时反复失败