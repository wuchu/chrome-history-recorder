## REMOVED Requirements

### Requirement: 炫酷 CLI 启动画面
**Reason**: The standalone `ai-classify` CLI is retired; the supported product entry point is the Chrome Extension DevTools Panel.
**Migration**: Use the DevTools Panel status, configuration, and classification controls.

### Requirement: 进度可视化
**Reason**: Terminal progress UI is no longer part of the supported product surface after removing the CLI package.
**Migration**: Use the DevTools Panel classification progress section.

### Requirement: 分类结果展示
**Reason**: Terminal result cards are tied to the retired standalone CLI workflow.
**Migration**: Use DevTools media grid cards and the media detail panel for classification results.

### Requirement: 运行时交互
**Reason**: Runtime keyboard controls are tied to the retired standalone CLI process.
**Migration**: Use DevTools scheduler controls for start, pause, retry failed, and clear queue actions.

### Requirement: 智能配置向导
**Reason**: Interactive CLI initialization is no longer needed when AI classification is configured through the Extension.
**Migration**: Use DevTools Ollama endpoint/model controls and Extension stored configuration.

### Requirement: 启动动画效果
**Reason**: CLI startup animations are out of scope after the CLI removal.
**Migration**: No migration required.

### Requirement: ANSI 颜色和样式
**Reason**: ANSI terminal styling is out of scope after the CLI removal.
**Migration**: Use DevTools Panel visual states and CSS styling.
