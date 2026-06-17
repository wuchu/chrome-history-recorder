## Why

目前项目的 VFS Service 后端已经完整支持视频文件的存储、缩略图生成和 HTTP 服务，但前端 Extension 的媒体浏览器 UI 无法预览视频，仅显示占位符文本和图标。这限制了用户查看已捕获视频内容的能力，需要添加视频播放器来完善用户体验。

## What Changes

- 在 MediaDetail 组件中添加 HTML5 `<video>` 播放器以支持视频预览
- 更新 MediaGrid、MasonryItem 和 VirtualMasonryGrid 组件以正确显示视频缩略图
- 添加视频播放器的样式支持（适配深色/浅色主题）
- 确保视频播放器支持常见格式（MP4、WebM、MOV）
- 可选：启用视频捕获功能（当前 debugger-capture 只捕获图片）

## Capabilities

### New Capabilities

- `video-preview-player`: 视频预览播放器功能，支持在 MediaDetail 中播放已捕获的视频文件
- `video-thumbnail-display`: 视频缩略图显示功能，确保视频在网格视图中正确显示缩略图

### Modified Capabilities

（无现有规范需要修改）

## Impact

- **Affected code**: `packages/extension/src/entrypoints/media-browser/components/` 下的媒体展示组件
- **No API changes**: 后端 HTTP/WebSocket API 已完全支持，无需修改
- **No new dependencies**: 使用原生 HTML5 `<video>` 标签，无需额外依赖
