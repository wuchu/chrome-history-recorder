## ADDED Requirements

### Requirement: 调试模式启动
代理服务必须 (SHALL) 支持调试模式启动，用于开发环境。

#### Scenario: 使用调试模式启动
- **WHEN** 用户运行 `npm run dev` 命令
- **THEN** 服务必须 (SHALL) 启动 nodemon 进程监听文件变更
- **AND** 服务必须 (SHALL) 在代码变更后自动重启

#### Scenario: 配置文件监听范围
- **WHEN** 调试模式启动
- **THEN** 服务必须 (SHALL) 监听 `src/` 目录下的所有 `.js` 文件
- **AND** 服务应该 (SHOULD) 忽略 `node_modules/` 目录

#### Scenario: 配置重启延迟
- **WHEN** 文件变更被检测到
- **THEN** 服务必须 (SHALL) 等待至少 1000ms 后才触发重启
- **AND** 服务必须 (SHALL) 合并同一延迟窗口内的多次变更

#### Scenario: 显示重启状态
- **WHEN** 服务因文件变更重启
- **THEN** 服务必须 (SHALL) 在控制台输出重启原因
- **AND** 服务必须 (SHALL) 输出变更的文件名

### Requirement: 调试日志系统
代理服务必须 (SHALL) 在调试模式下提供分级日志系统。

#### Scenario: 日志级别配置
- **WHEN** 环境变量 `DEBUG_LEVEL` 设置为 `DEBUG`/`INFO`/`WARN`/`ERROR`
- **THEN** 服务必须 (SHALL) 仅输出该级别及以上级别的日志
- **AND** 默认级别必须 (SHALL) 为 `INFO`

#### Scenario: 请求日志记录
- **WHEN** 收到 HTTP 请求
- **THEN** 服务必须 (SHALL) 记录请求方法、路径、时间戳
- **AND** 服务必须 (SHALL) 记录响应状态码和耗时

#### Scenario: 结构化日志格式
- **WHEN** 输出日志
- **THEN** 日志必须 (SHALL) 使用 JSON 格式包含以下字段：
  - `level`: 日志级别
  - `timestamp`: ISO 8601 格式时间
  - `message`: 日志内容
  - `context`: 上下文信息（可选）

#### Scenario: 内存日志缓存
- **WHEN** 调试模式启用
- **THEN** 服务必须 (SHALL) 在内存中缓存最近 100 条日志
- **AND** 缓存必须 (SHALL) 以环形队列方式存储

#### Scenario: 生产模式禁用调试日志
- **WHEN** 服务以生产模式启动（无 DEBUG_MODE 环境变量）
- **THEN** 服务必须 (SHALL) 不加载调试日志模块
- **AND** 服务必须 (SHALL) 仅使用基础 console 输出

### Requirement: 调试端点
代理服务必须 (SHALL) 在调试模式下提供调试信息端点。

#### Scenario: 状态端点
- **WHEN** 在 `/debug/status` 接收到 GET 请求
- **THEN** 服务必须 (SHALL) 返回服务运行状态 JSON：
  - `mode`: 当前运行模式（debug/production）
  - `uptime`: 运行时长（秒）
  - `restartCount`: 重启次数
  - `lastRestart`: 上次重启时间

#### Scenario: 日志端点
- **WHEN** 在 `/debug/logs` 接收到 GET 请求
- **THEN** 服务必须 (SHALL) 返回内存缓存的日志数组
- **AND** 服务必须 (SHALL) 支持 `?limit=N` 参数限制返回数量

#### Scenario: 手动重启端点
- **WHEN** 在 `/debug/restart` 接收到 POST 请求
- **THEN** 服务必须 (SHALL) 触发优雅重启流程
- **AND** 服务必须 (SHALL) 返回重启确认消息

#### Scenario: 调试端点安全控制
- **WHEN** 服务以生产模式启动
- **THEN** 服务必须 (SHALL) 不注册 `/debug/*` 路由
- **AND** 访问调试端点必须 (SHALL) 返回 404 Not Found