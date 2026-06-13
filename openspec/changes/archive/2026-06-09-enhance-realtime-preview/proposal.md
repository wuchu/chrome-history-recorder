## Why

当前 DevTools 面板存在两个用户体验问题：
1. **实时更新缺失**：捕获的图片需要切换 tab 才能显示，因为当前使用 1 秒轮询机制，存在延迟和 React 批处理问题
2. **预览功能缺失**：图片列表只显示文本信息（URL、大小、类型），没有缩略图预览，用户难以快速识别内容

虽然 `websocket-events` 和 `thumbnail-generation` specs 已经定义了相关功能，但 Proxy 和 Extension 都未实现。

## What Changes

- 实现 Proxy WebSocket 服务端点 `/events`，推送 `file:captured` 和 `classify:complete` 事件
- 实现 Extension WebSocket 客户端 hook `useWebSocket`，替代轮询机制
- 实现 Proxy 缩略图生成 API `/images/:hash/thumbnail`
- 改造 MediaItem 组件，显示缩略图预览和分类状态
- 添加实时捕获流组件 `CaptureStream`，展示最新捕获的媒体

## Capabilities

### New Capabilities

- `websocket-client`: Extension WebSocket 客户端能力，连接 Proxy 实时接收事件并更新 UI

### Modified Capabilities

- `websocket-events`: 扩展 spec，补充 Extension 客户端实现要求（原 spec 只定义了服务端）
- `thumbnail-generation`: 扩展 spec，补充 Extension 缩略图显示要求（原 spec 只定义了 API）
- `devtools-media-grid`: 新增能力，定义媒体网格显示和预览功能（替代简单的文本列表）

## Impact

- **packages/proxy/src/**: 添加 WebSocket 服务和缩略图生成路由
- **packages/extension/src/**: 添加 useWebSocket hook、改造 MediaItem、新增 CaptureStream
- **API 端点**: 新增 `/events` WebSocket 端点、`/images/:hash/thumbnail` REST 端点
- **依赖**: 添加 `ws` (WebSocket 库)、`sharp` (图片处理库)