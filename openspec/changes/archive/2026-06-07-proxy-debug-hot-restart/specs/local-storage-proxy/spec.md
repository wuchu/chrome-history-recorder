## ADDED Requirements

### Requirement: 调试环境变量配置
代理服务必须 (SHALL) 支持通过环境变量控制调试功能。

#### Scenario: 启用调试模式
- **WHEN** 环境变量 `DEBUG_MODE=true`
- **THEN** 服务必须 (SHALL) 启用调试日志系统
- **AND** 服务必须 (SHALL) 注册调试端点

#### Scenario: 配置日志级别
- **WHEN** 环境变量 `LOG_LEVEL=DEBUG|INFO|WARN|ERROR`
- **THEN** 服务必须 (SHALL) 使用指定的日志级别
- **AND** 默认必须 (SHALL) 为 `INFO`

#### Scenario: 配置重启延迟
- **WHEN** 环境变量 `RESTART_DELAY=<milliseconds>`
- **THEN** nodemon 必须 (SHALL) 使用指定的延迟时间
- **AND** 默认必须 (SHALL) 为 1000ms

### Requirement: 调试信息集成到健康检查
健康检查端点必须 (SHALL) 在调试模式下返回额外调试信息。

#### Scenario: 调试模式健康检查
- **WHEN** 在 `/health` 接收到 GET 请求且调试模式启用
- **THEN** 响应必须 (SHALL) 包含调试信息：
  - `debugMode`: true
  - `restartCount`: 重启次数
  - `lastRestart`: 上次重启时间
- **AND** 响应该 (SHOULD) 包含最近错误信息（如有）