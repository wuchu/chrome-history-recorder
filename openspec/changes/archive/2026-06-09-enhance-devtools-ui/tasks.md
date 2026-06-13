## 1. Proxy - 添加缩略图生成

- [ ] 1.1 添加 sharp 到 proxy package.json dependencies
- [ ] 1.2 创建 src/routes/thumbnail.ts
- [ ] 1.3 实现 GET /images/:hash/thumbnail 端点
- [ ] 1.4 实现图片缩略图生成（使用 sharp）
- [ ] 1.5 实现视频缩略图生成（使用 ffmpeg）
- [ ] 1.6 实现缩略图缓存到 .thumbnails/ 目录
- [ ] 1.7 实现 Cache-Control 和 ETag 响应头
- [ ] 1.8 实现尺寸参数支持（small/medium/large 或数字）
- [ ] 1.9 在 server.ts 中注册路由

## 2. Proxy - 添加搜索过滤 API

- [ ] 2.1 创建 src/routes/search.ts
- [ ] 2.2 实现 GET /images/search 端点
- [ ] 2.3 实现 q 参数搜索文件名和分类
- [ ] 2.4 实现 type 参数过滤类型（image/video）
- [ ] 2.5 实现 category 参数过滤分类
- [ ] 2.6 实现 date 参数过滤日期
- [ ] 2.7 实现 sort 参数排序（newest/oldest/confidence）
- [ ] 2.8 实现 page 和 limit 参数分页
- [ ] 2.9 在 server.ts 中注册路由

## 3. Proxy - 添加 WebSocket 服务

- [ ] 3.1 添加 ws 到 proxy package.json dependencies
- [ ] 3.2 创建 src/websocket/server.ts
- [ ] 3.3 实现 WebSocketServer 类
- [ ] 3.4 实现 ws://localhost:3777/events 端点
- [ ] 3.5 实现连接心跳（30秒间隔）
- [ ] 3.6 实现 broadcast() 方法推送事件
- [ ] 3.7 实现订阅过滤支持
- [ ] 3.8 实现发送 service:started 事件
- [ ] 3.9 在 server.ts 中初始化 WebSocketServer
- [ ] 3.10 改造 Proxy 发射 file:captured 事件

## 4. Proxy - 集成分类事件

- [ ] 4.1 在 WebSocketServer 中监听 classify:started
- [ ] 4.2 在 WebSocketServer 中监听 classify:complete
- [ ] 4.3 在 WebSocketServer 中监听 classify:failed
- [ ] 4.4 实现 classify:progress 事件（可选）
- [ ] 4.5 实现事件格式标准化（event + data + timestamp）

## 5. Extension - WebSocket 客户端

- [ ] 5.1 创建 src/hooks/useWebSocket.ts
- [ ] 5.2 实现 WebSocket 连接
- [ ] 5.3 实现断线重连（5秒间隔）
- [ ] 5.4 实现事件接收和存储
- [ ] 5.5 实现订阅消息发送
- [ ] 5.6 返回 connected 和 events 状态

## 6. Extension - 实时捕获流组件

- [ ] 6.1 创建 src/components/CaptureStream.tsx
- [ ] 6.2 创建 CaptureStream.module.css
- [ ] 6.3 实现缩略图流式显示
- [ ] 6.4 实现最新 10 个媒体的展示
- [ ] 6.5 实现新捕获动画效果
- [ ] 6.6 实现分类状态图标显示
- [ ] 6.7 实现点击跳转到历史结果

## 7. Extension - 缩略图网格组件

- [ ] 7.1 创建 src/components/MediaGrid.tsx
- [ ] 7.2 创建 MediaGrid.module.css
- [ ] 7.3 实现 CSS Grid 布局
- [ ] 7.4 实现 MediaItem 子组件
- [ ] 7.5 实现缩略图懒加载
- [ ] 7.6 实现分类信息显示
- [ ] 7.7 实现置信度可视化
- [ ] 7.8 实现点击打开详情

## 8. Extension - 详情面板组件

- [ ] 8.1 创建 src/components/MediaDetail.tsx
- [ ] 8.2 创建 MediaDetail.module.css
- [ ] 8.3 实现大图预览
- [ ] 8.4 实现分类结果显示
- [ ] 8.5 实现文件信息显示
- [ ] 8.6 实现来源 URL 链接
- [ ] 8.7 实现标签列表
- [ ] 8.8 实现重新分类按钮
- [ ] 8.9 实现删除按钮
- [ ] 8.10 实现复制文件名按钮

## 9. Extension - 搜索过滤组件

- [ ] 9.1 创建 src/components/FilterBar.tsx
- [ ] 9.2 创建 FilterBar.module.css
- [ ] 9.3 实现分类下拉过滤
- [ ] 9.4 实现类型下拉过滤
- [ ] 9.5 实现日期下拉过滤
- [ ] 9.6 实现搜索输入框
- [ ] 9.7 实现排序下拉
- [ ] 9.8 创建 src/hooks/useSearch.ts 实现搜索逻辑

## 10. Extension - 改造主应用

- [ ] 10.1 改造 App.tsx 集成 WebSocket
- [ ] 10.2 改造 App.tsx 替换列表为网格
- [ ] 10.3 添加实时捕获流区域
- [ ] 10.4 添加历史结果网格区域
- [ ] 10.5 添加详情面板（模态或侧边）
- [ ] 10.6 改造 StatusBar 显示 Proxy + AI 状态
- [ ] 10.7 改造 ConfigSection 为可折叠
- [ ] 10.8 实现服务状态聚合显示

## 11. Extension - 分类状态 Hook

- [ ] 11.1 创建 src/hooks/useClassifyStatus.ts
- [ ] 11.2 实现从 WebSocket 事件更新状态
- [ ] 11.3 实现 classify:started 处理
- [ ] 11.4 实现 classify:complete 处理
- [ ] 11.5 实现 classify:failed 处理
- [ ] 11.6 返回 classifyStatus 对象

## 12. 测试和验证

- [ ] 12.1 测试 Proxy 缩略图生成
- [ ] 12.2 测试缩略图缓存生效
- [ ] 12.3 测试 WebSocket 连接和重连
- [ ] 12.4 测试 file:captured 事件推送
- [ ] 12.5 测试 classify:* 事件推送
- [ ] 12.6 测试 Extension 缩略图网格显示
- [ ] 12.7 测试实时捕获流更新
- [ ] 12.8 测试搜索过滤功能
- [ ] 12.9 测试详情面板打开和操作
- [ ] 12.10 测试服务状态正确显示

## 13. 文档更新

- [ ] 13.1 更新 README.md 展示新 UI
- [ ] 13.2 更新 API 文档说明新增端点
- [ ] 13.3 说明 WebSocket 事件格式
- [ ] 13.4 说明缩略图缓存策略