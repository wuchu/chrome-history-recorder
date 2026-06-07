## 1. 环境配置

- [x] 1.1 安装 nodemon 开发依赖到 proxy/package.json
- [x] 1.2 安装 pino 和 pino-pretty 日志依赖
- [x] 1.3 添加 dev 脚本到 proxy/package.json
- [x] 1.4 创建 nodemon.json 配置文件

## 2. 调试日志系统

- [x] 2.1 创建 proxy/src/logger.js 模块
- [x] 2.2 实现分级日志函数（DEBUG/INFO/WARN/ERROR）
- [x] 2.3 实现内存日志缓存（环形队列，100条）
- [x] 2.4 添加请求日志中间件（记录方法/路径/耗时）
- [x] 2.5 在关键路径添加日志调用（save-image/health/config）

## 3. 调试端点

- [x] 3.1 创建 proxy/src/routes/debug.js 路由模块
- [x] 3.2 实现 /debug/status 端点（返回运行状态）
- [x] 3.3 实现 /debug/logs 端点（返回内存日志）
- [x] 3.4 实现 /debug/restart 端点（手动触发重启）
- [x] 3.5 在 server.js 中注册调试路由（仅 DEBUG_MODE=true）

## 4. 优雅关闭

- [x] 4.1 实现 gracefulShutdown 函数（处理 SIGTERM/SIGINT）
- [x] 4.2 添加关闭超时处理（5秒强制关闭）
- [x] 4.3 维护重启计数器和时间戳
- [x] 4.4 在 server.js 中注册信号处理器

## 5. 健康检查增强

- [x] 5.1 修改 /health 端点支持调试信息返回
- [x] 5.2 添加 debugMode/restartCount/lastRestart 字段

## 6. 测试验证

- [x] 6.1 测试 npm run dev 启动调试模式
- [x] 6.2 测试文件变更触发自动重启
- [x] 6.3 测试调试端点功能（status/logs/restart）
- [x] 6.4 测试生产模式无调试功能影响
- [x] 6.5 测试优雅关闭流程