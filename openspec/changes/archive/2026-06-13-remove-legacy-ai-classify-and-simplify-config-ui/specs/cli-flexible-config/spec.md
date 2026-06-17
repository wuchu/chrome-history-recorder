## REMOVED Requirements

### Requirement: 自定义配置文件路径
**Reason**: The standalone `ai-classify` CLI and its config-file loading behavior are retired.
**Migration**: Use Extension configuration stored through Chrome storage and Background config management.

### Requirement: 纯参数启动模式
**Reason**: The supported workflow no longer starts classification from CLI parameters.
**Migration**: Use DevTools capture/classification controls.

### Requirement: 全局选项支持
**Reason**: Standalone CLI subcommands and global options are removed with the CLI package.
**Migration**: Use Extension DevTools controls and Background messages.

### Requirement: 自定义分类提示词
**Reason**: CLI prompt override flags are retired with the standalone CLI configuration surface.
**Migration**: Use the Extension's classifier defaults and supported Background configuration fields.

### Requirement: 最大并发请求数配置
**Reason**: CLI concurrency flags are retired with the standalone CLI.
**Migration**: Use Extension Background scheduler configuration where supported.
