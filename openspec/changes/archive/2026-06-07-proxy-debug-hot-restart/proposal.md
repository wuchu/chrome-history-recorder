## Why

当前 proxy 服务在开发和调试时需要手动重启才能加载代码变更，开发效率低下。开发者每次修改代码后需要：
1. 手动停止服务进程
2. 重新启动服务
3. 等待服务初始化完成

这增加了开发周期，降低了迭代速度。引入调试模式和热重启支持可以显著提升开发体验。

## What Changes

- 新增调试模式启动命令 `npm run dev`，支持：
  - 文件变更监听
  - 代码变更后自动重启服务
  - 保持现有连接状态（可选）
- 新增调试日志系统，支持：
  - 分级日志输出（DEBUG/INFO/WARN/ERROR）
  - 请求/响应详细追踪
  - 性能指标记录
- 新增调试端点 `/debug/*`，支持：
  - 实时查看服务状态
  - 查看最近的请求日志
  - 手动触发重启

## Capabilities

### New Capabilities
- `proxy-debug-mode`: 调试模式启动和运行，包括文件监听、自动重启、调试日志
- `proxy-hot-restart`: 热重启机制，支持无中断服务更新

### Modified Capabilities
- `local-storage-proxy`: 新增调试相关端点和日志配置选项

## Impact

- 新增依赖：`nodemon` 或类似文件监听库
- 修改 `proxy/package.json` 添加开发脚本
- 修改 `proxy/src/server.js` 添加调试日志系统
- 新增调试端点，不影响生产模式性能
- API 兼容：现有端点保持不变，仅新增调试端点