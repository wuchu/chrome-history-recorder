## Why

用户在浏览网页时经常遇到想要保存的视频内容（如教程、演示、短视频等）。与图片类似，手动保存视频链接或使用第三方工具既繁琐又不方便。现有项目已实现图片捕获功能，扩展支持视频捕获可以提供更完整的媒体保存体验。

## What Changes

- **视频捕获扩展**: 在现有 NetworkListener 基础上增加视频请求拦截功能
- **DevTools 面板增强**: 扩展 UI 支持视频列表显示、状态统计、配置选项
- **代理服务扩展**: 支持视频文件存储，处理大文件上传（分块传输）
- **视频格式支持**: 支持常见视频格式（MP4、WebM、MOV 等）的捕获和保存
- **去重机制**: 继承现有内容哈希去重机制，避免重复保存相同视频

## Capabilities

### New Capabilities

- `video-capture`: 视频请求拦截、内容提取和保存功能

### Modified Capabilities

- `image-capture-extension`: 扩展 DevTools 面板 UI 以支持视频显示和配置
- `local-storage-proxy`: 支持大文件（视频）的分块上传和存储

## Impact

- **扩展代码**:
  - NetworkListener 类增加视频处理逻辑
  - App.vue 增加 video 列表区域和统计
- **代理服务**:
  - server.js 支持大文件请求（增加 body size limit）
  - 新增 `/save-video` 端点（可选，或复用 `/save-image`）
- **配置**:
  - 新增视频类型过滤器（MP4、WebM、MOV 等）
  - 新增视频最小尺寸过滤器（如 1MB）