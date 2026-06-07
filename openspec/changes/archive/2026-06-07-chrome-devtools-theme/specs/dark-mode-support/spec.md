## MODIFIED Requirements

### Requirement: 深色模式支持
深色模式必须 (SHALL) 精确匹配 Chrome DevTools 深色主题颜色值。

#### Scenario: 深色主题颜色精确匹配
- **WHEN** 用户切换到深色模式
- **THEN** 面板必须 (SHALL) 使用以下精确颜色值：
  - `--bg-primary: #1e1e1e`（主背景）
  - `--bg-secondary: #252526`（次级背景）
  - `--bg-tertiary: #2d2d30`（第三级背景）
  - `--text-primary: #e0e0e0`（主文字）
  - `--text-secondary: #cccccc`（次级文字）
  - `--border-color: #3c3c3c`（边框）

#### Scenario: 状态指示颜色保持一致
- **WHEN** 显示状态指示（在线/离线）
- **THEN** 颜色 必须 (SHALL) 保持与 Chrome DevTools 一致：
  - 在线/成功：绿色 (#4caf50 或 Chrome 原生绿色)
  - 离线/错误：红色 (#f44336 或 Chrome 原生红色)
  - 警告：橙色 (#ff9800 或 Chrome 原生橙色）