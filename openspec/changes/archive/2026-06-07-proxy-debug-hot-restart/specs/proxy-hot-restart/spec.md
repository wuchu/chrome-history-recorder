## ADDED Requirements

### Requirement: 优雅关闭
代理服务必须 (SHALL) 支持优雅关闭，确保现有请求完成后再重启。

#### Scenario: 接收关闭信号
- **WHEN** 进程收到 SIGTERM 或 SIGINT 信号
- **THEN** 服务必须 (SHALL) 停止接受新请求
- **AND** 服务必须 (SHALL) 等待现有请求完成

#### Scenario: 关闭超时处理
- **WHEN** 等待现有请求超过 5 秒
- **THEN** 服务必须 (SHALL) 强制关闭剩余连接
- **AND** 服务必须 (SHALL) 记录超时警告日志

#### Scenario: 保持连接状态
- **WHEN** 重启过程中
- **THEN** Chrome 扩展必须 (SHALL) 自动重连到新进程
- **AND** 扩展必须 (SHALL) 在连接断开时显示离线状态

### Requirement: 重启状态追踪
代理服务必须 (SHALL) 追踪和报告重启状态。

#### Scenario: 重启计数
- **WHEN** 服务重启
- **THEN** 服务必须 (SHALL) 维护重启计数器
- **AND** 计数器必须 (SHALL) 通过 `/debug/status` 端点暴露

#### Scenario: 重启时间记录
- **WHEN** 服务重启完成
- **THEN** 服务必须 (SHALL) 记录上次重启时间戳
- **AND** 时间戳必须 (SHALL) 使用 ISO 8601 格式

#### Scenario: 重启原因记录
- **WHEN** 服务重启
- **THEN** 服务必须 (SHALL) 记录重启原因：
  - `file-change`: 文件变更触发
  - `manual`: 手动触发
  - `error`: 错误触发

### Requirement: 错误恢复
代理服务必须 (SHALL) 在错误情况下自动恢复。

#### Scenario: 启动失败处理
- **WHEN** 服务因语法错误无法启动
- **THEN** nodemon 必须 (SHALL) 保持监听状态
- **AND** nodemon 必须 (SHALL) 在文件修正后自动重试

#### Scenario: 运行时错误处理
- **WHEN** 服务遇到未捕获异常
- **THEN** 服务必须 (SHALL) 记录错误详情
- **AND** 服务应该 (SHOULD) 尝试优雅重启