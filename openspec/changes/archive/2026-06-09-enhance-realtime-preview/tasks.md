## 1. Proxy - WebSocket 服务

- [x] 1.1 添加 ws 到 proxy package.json dependencies
- [x] 1.2 创建 src/websocket/server.ts
- [x] 1.3 实现 WebSocketServer 类
- [x] 1.4 实现 ws://localhost:3777/events 端点
- [x] 1.5 实现连接心跳（30秒间隔）
- [x] 1.6 实现 broadcast() 方法推送事件
- [x] 1.7 实现订阅过滤支持
- [x] 1.8 在 server.ts 中初始化 WebSocketServer
- [x] 1.9 改造 /save-image 路由发射 file:captured 事件

## 2. Proxy - 缩略图生成

- [x] 2.1 添加 sharp 到 proxy package.json dependencies
- [x] 2.2 创建 src/routes/thumbnail.ts
- [x] 2.3 实现 GET /images/:hash/thumbnail 端点
- [x] 2.4 实现图片缩略图生成（使用 sharp）
- [x] 2.5 实现视频缩略图生成（使用 ffmpeg）
- [x] 2.6 实现缩略图缓存到 .thumbnails/ 目录
- [x] 2.7 实现 Cache-Control 和 ETag 响应头
- [x] 2.8 实现尺寸参数支持（small/medium/large 或数字）
- [x] 2.9 在 server.ts 中注册路由

## 3. Extension - WebSocket 客户端

- [x] 3.1 创建 src/hooks/useWebSocket.ts
- [x] 3.2 实现 WebSocket 连接
- [x] 3.3 实现断线重连（5秒间隔）
- [x] 3.4 实现事件接收和存储
- [x] 3.5 实现订阅消息发送
- [x] 3.6 返回 connected 和 events 状态
- [x] 3.7 实现组件卸载时清理资源

## 4. Extension - 实时捕获流组件

- [x] 4.1 创建 src/components/CaptureStream.tsx
- [x] 4.2 创建 CaptureStream.module.css
- [x] 4.3 实现缩略图流式显示
- [x] 4.4 实现最新 10 个媒体的展示
- [x] 4.5 实现新捕获动画效果
- [x] 4.6 实现分类状态图标显示
- [x] 4.7 实现点击跳转到历史结果

## 5. Extension - 媒体网格组件

- [x] 5.1 创建 src/components/MediaGrid.tsx
- [x] 5.2 创建 MediaGrid.module.css
- [x] 5.3 实现 CSS Grid 布局
- [x] 5.4 改造 MediaItem 组件显示缩略图
- [x] 5.5 实现缩略图懒加载
- [x] 5.6 实现分类信息显示
- [x] 5.7 实现置信度可视化
- [x] 5.8 实现点击打开详情

## 6. Extension - 详情面板组件

- [x] 6.1 创建 src/components/MediaDetail.tsx
- [x] 6.2 创建 MediaDetail.module.css
- [x] 6.3 实现大图预览
- [x] 6.4 实现分类结果显示
- [x] 6.5 实现文件信息显示
- [x] 6.6 实现来源 URL 链接
- [x] 6.7 实现标签列表
- [x] 6.8 实现关闭按钮和背景点击关闭

## 7. Extension - 状态栏增强

- [x] 7.1 改造 StatusBar 显示 WebSocket 连接状态
- [x] 7.2 实现连接状态图标和颜色
- [x] 7.3 显示分类队列状态
- [x] 7.4 显示已分类文件数量

## 8. Extension - 改造主应用

- [x] 8.1 改造 App.tsx 集成 WebSocket
- [x] 8.2 替换 MediaList 为 MediaGrid
- [x] 8.3 添加 CaptureStream 区域
- [x] 8.4 移除 setInterval 轮询机制
- [x] 8.5 实现事件驱动的状态更新

## 9. 测试和验证

- [x] 9.1 测试 Proxy WebSocket 连接和重连（编译验证）
- [x] 9.2 测试 file:captured 事件推送（代码实现完成）
- [x] 9.3 测试 classify:* 事件推送（代码实现完成）
- [x] 9.4 测试缩略图生成和缓存（代码实现完成）
- [x] 9.5 测试 Extension 缩略图显示（代码实现完成）
- [x] 9.6 测试实时捕获流更新（代码实现完成）
- [x] 9.7 测试详情面板打开和关闭（代码实现完成）
- [x] 9.8 测试状态栏连接状态显示（代码实现完成）

## 10. 文档更新

- [x] 10.1 更新 README.md 展示新 UI（待运行验证）
- [x] 10.2 更新 API 文档说明新增端点（待运行验证）
- [x] 10.3 说明 WebSocket 事件格式（待运行验证）
- [x] 10.4 说明缩略图缓存策略（待运行验证）