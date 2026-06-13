## 1. 抽取核心分类引擎

- [ ] 1.1 创建 packages/ai-classify/src/core.ts
- [ ] 1.2 从 index.ts 抽取 AIClassifyCore 类
- [ ] 1.3 实现 enqueue() 方法入队文件
- [ ] 1.4 实现 getStatus() 方法返回队列状态
- [ ] 1.5 实现 getResults() 方法返回分类结果
- [ ] 1.6 实现 reprocess() 方法重新处理文件
- [ ] 1.7 实现 setEventEmitter() 支持事件发射
- [ ] 1.8 改造 index.ts 导出 AIClassifyCore

## 2. 创建 Proxy 插件实现

- [ ] 2.1 创建 packages/ai-classify/src/plugins/proxy/ 目录
- [ ] 2.2 创建 plugin.ts 实现 ProxyPlugin 接口
- [ ] 2.3 实现 onLoad() 初始化 AIClassifyCore
- [ ] 2.4 实现 onUnload() 停止分类服务
- [ ] 2.5 实现 afterSave 钩子自动入队新文件
- [ ] 2.6 实现 GET /classify/status 路由
- [ ] 2.7 实现 GET /classify/results 路由
- [ ] 2.8 实现 GET /classify/results/:hash 路由
- [ ] 2.9 实现 POST /classify/reprocess/:hash 路由
- [ ] 2.10 实现 GET /classify/config 路由

## 3. 在 Proxy 中集成插件

- [ ] 3.1 创建 packages/proxy/plugins/ai-classify/ 目录
- [ ] 3.2 创建软链接或复制 plugin.ts 到该目录
- [ ] 3.3 在 proxy-config.yaml 中添加 ai-classify 插件配置
- [ ] 3.4 配置 ollamaEndpoint、visionModel、language 等参数
- [ ] 3.5 测试 Proxy 启动时加载 AI Classify 插件

## 4. 实现事件发射

- [ ] 4.1 在 core.ts 中发射 classify:started 事件
- [ ] 4.2 在 core.ts 中发射 classify:progress 事件（可选）
- [ ] 4.3 在 core.ts 中发射 classify:complete 事件
- [ ] 4.4 在 core.ts 中发射 classify:failed 事件
- [ ] 4.5 测试事件通过 context.emit 发送

## 5. 改造 CLI 模式使用核心引擎

- [ ] 5.1 改造 cli.ts start 命令使用 AIClassifyCore
- [ ] 5.2 CLI 模式保持炫酷 UI 输出
- [ ] 5.3 CLI 模式保持键盘交互
- [ ] 5.4 CLI 模式保持目录监控启动
- [ ] 5.5 测试 CLI 模式正常运行

## 6. 实现插件状态显示

- [ ] 6.1 在 Proxy 启动输出中显示 AI Classify 插件状态
- [ ] 6.2 显示 Ollama 连接状态
- [ ] 6.3 显示当前队列状态
- [ ] 6.4 显示已分类文件数量

## 7. 测试插件功能

- [ ] 7.1 测试新文件保存后自动入队
- [ ] 7.2 测试 /classify/status API 返回正确状态
- [ ] 7.3 测试 /classify/results API 返回正确结果
- [ ] 7.4 测试 /classify/reprocess API 重新处理
- [ ] 7.5 测试 WebSocket 事件正确发射
- [ ] 7.6 测试插件和 CLI 模式都能独立运行

## 8. 配置文档

- [ ] 8.1 更新 README.md 说明插件模式
- [ ] 8.2 说明 proxy-config.yaml 中的插件配置
- [ ] 8.3 说明插件 API 端点
- [ ] 8.4 说明 WebSocket 事件类型