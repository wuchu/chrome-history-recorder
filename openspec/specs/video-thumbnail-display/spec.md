# Purpose

TBD - Video thumbnail display functionality in media grids.

## Requirements

### Requirement: Video thumbnail in MediaGrid
MediaGrid 组件 SHALL 为视频项显示缩略图而非图标。

#### Scenario: Display video thumbnail in grid
- **WHEN** MediaGrid 渲染一个 MIME 类型以 `video/` 开头的媒体项
- **THEN** 使用 VFS 生成的缩略图，通过 `<img>` 标签显示，而非 🎬 图标

#### Scenario: Video thumbnail lazy loading
- **WHEN** 视频缩略图在视口外
- **THEN** 使用懒加载，与图片缩略图行为一致

### Requirement: Video thumbnail in Masonry
MasonryItem 组件 SHALL 正确处理视频缩略图。

#### Scenario: Display video thumbnail in masonry
- **WHEN** MasonryItem 渲染一个 MIME 类型以 `video/` 开头的媒体项
- **THEN** 使用与图片相同的缩略图加载逻辑

#### Scenario: Fallback on thumbnail error
- **WHEN** 视频缩略图加载失败
- **THEN** 显示友好的错误提示或降级显示图标

### Requirement: Thumbnail build utilities
现有工具函数 SHALL 支持视频缩略图构建。

#### Scenario: Build video thumbnail URL
- **WHEN** 调用 `buildVfsThumbnailUrl()` 用于视频 hash
- **THEN** 返回正确的 HTTP URL，与图片行为一致
