## ADDED Requirements

### Requirement: 原生 Chrome DevTools 视觉风格
DevTools 面板必须 (SHALL) 使用与 Chrome DevTools 一致的视觉风格。

#### Scenario: 浅色主题配色
- **WHEN** 系统使用浅色模式
- **THEN** 面板必须 (SHALL) 使用 Chrome DevTools 浅色主题标准配色：
  - 背景：白色 (#ffffff) / 浅灰 (#f3f3f3)
  - 文字：深灰 (#333333)
  - 边框：浅灰 (#d0d0d0)

#### Scenario: 深色主题配色
- **WHEN** 系统使用深色模式
- **THEN** 面板必须 (SHALL) 使用 Chrome DevTools 深色主题标准配色：
  - 背景：深灰 (#1e1e1e / #252526)
  - 文字：浅灰 (#e0e0e0)
  - 边框：深灰 (#3c3c3c)

#### Scenario: 字体一致性
- **WHEN** 面板渲染文字
- **THEN** 字体 必须 (SHALL) 使用 Chrome DevTools 原生字体栈
- **AND** 字体大小 必须 (SHALL) 为 11px-12px（与 DevTools 一致）

### Requirement: 无边距布局
DevTools 面板必须 (SHALL) 充分利用可用空间，无额外边距。

#### Scenario: 移除面板边距
- **WHEN** 面板在 DevTools 中渲染
- **THEN** 面板 必须 (SHALL) 无外层 padding/margin
- **AND** 内容 必须 (SHALL) 紧贴面板边缘

#### Scenario: 组件内部间距
- **WHEN** 组件需要间距
- **THEN** 间距 必须 (SHALL) 在组件内部实现
- **AND** 间距 应该 (SHOULD) 使用 8px 或更小的值