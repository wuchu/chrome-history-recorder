## Context

当前 DevTools 面板使用轮询机制（每秒调用 `updateStats`）获取捕获的媒体列表，存在两个问题：
1. 更新延迟：用户需要等待最多 1 秒才能看到新捕获的内容
2. React 批处理：切换 tab 时才触发渲染，导致状态更新不及时

同时，媒体列表只显示文本信息，没有缩略图预览，用户难以快速识别捕获的内容。

### 现有架构

```
┌─────────────────────────────────────────────────────────────┐
│                    当前架构                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Proxy (HTTP only)                                         │
│   ┌─────────────────┐                                       │
│   │ /save-image     │                                       │
│   │ /health         │                                       │
│   └─────────────────┘                                       │
│                                                             │
│   Extension                                                  │
│   ┌─────────────────┐                                       │
│   │ NetworkListener │──────▶ setInterval(1000ms)            │
│   │                 │──────▶ getCapturedImages()            │
│   └─────────────────┘                                       │
│          │                                                   │
│          ▼                                                   │
│   MediaList (文本列表)                                       │
│   - URL、大小、类型                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 已有 Specs

- `websocket-events`: 定义了服务端 WebSocket 端点，但未实现
- `thumbnail-generation`: 定义了缩略图 API，但未实现

## Goals / Non-Goals

**Goals:**
- 实现 WebSocket 实时推送，替代轮询机制
- 实现缩略图生成和显示
- 用户可以实时看到捕获的内容（无需切换 tab）
- 用户可以预览捕获的图片/视频缩略图
- 显示分类状态和结果

**Non-Goals:**
- 不改变现有的捕获逻辑（NetworkListener）
- 不实现视频播放功能
- 不实现图片编辑功能

## Decisions

### 1. WebSocket 实现方案

**决定**: 使用 `ws` 库在 Proxy 中实现 WebSocket 服务

**方案对比**:
- A) 使用 `socket.io` - 功能丰富，但增加了不必要的复杂性
- B) 使用原生 `ws` 库 - 轻量、原生 WebSocket、性能好
- C) 使用 Server-Sent Events (SSE) - 简单，但只支持单向通信

**选择**: 方案 B - 使用 `ws` 库，因为：
- 轻量级，不需要额外协议
- 支持双向通信（未来可能需要客户端订阅过滤）
- Node.js 原生 WebSocket 实现

### 2. 缩略图生成方案

**决定**: 使用 `sharp` 库处理图片，FFmpeg 处理视频

**方案对比**:
- A) 使用 `jimp` - 纯 JS，但性能较慢
- B) 使用 `sharp` - 基于 libvips，高性能
- C) 调用外部服务 - 增加 latency

**选择**: 方案 B - 使用 `sharp`，因为：
- 高性能图片处理
- 支持 WebP 输出
- 内存占用小

视频缩略图使用 FFmpeg 提取第一帧（已定义在 thumbnail-generation spec）

### 3. Extension 状态更新机制

**决定**: 使用 WebSocket 事件直接更新 React 状态

**架构**:
```
WebSocket Event ──▶ useWebSocket hook ──▶ setImages() ──▶ React render
```

替代当前的：
```
setInterval ──▶ getCapturedImages() ──▶ setImages() ──▶ React render
```

### 4. 缩略图缓存策略

**决定**: 缓存到 `.thumbnails/` 目录，文件名 `<hash>_<size>.webp`

- 首次生成后缓存，后续直接返回
- 使用 Cache-Control 和 ETag 响应头
- 缓存 TTL: 24 小时

## Risks / Trade-offs

### Risk: WebSocket 连接断开导致更新中断
→ **Mitigation**: 实现断线重连（5 秒间隔），显示连接状态

### Risk: 缩略图生成占用 CPU 资源
→ **Mitigation**: 使用队列限制并发，默认并发数 3

### Risk: Extension 首次加载时 WebSocket 未连接
→ **Mitigation**: 首次使用 HTTP API 获取现有数据，然后切换到 WebSocket 实时更新

## Migration Plan

1. **Phase 1**: Proxy 实现 WebSocket 服务
2. **Phase 2**: Proxy 实现缩略图 API
3. **Phase 3**: Extension 实现 useWebSocket hook
4. **Phase 4**: Extension 改造 MediaItem 和 CaptureStream
5. **Phase 5**: 移除 setInterval 轮询机制

## Open Questions

- [ ] WebSocket 是否需要支持事件过滤？（建议暂不实现，后续按需添加）
- [ ] 缩略图默认尺寸？（建议 small=100px）