## Context

Chrome DevTools 使用特定的配色方案和字体栈，通过 CSS 变量定义主题。深色模式切换时，颜色值自动更新。

**Chrome DevTools 原生样式特点**：
- 浅色主题：白色背景 + 浅灰边框
- 深色主题：深灰背景 (#1e1e1e / #2d2d2d)
- 字体：`'.SFNSDisplay-Regular', 'Helvetica Neue', 'Lucida Grande', sans-serif` (macOS) 或系统默认
- 紧凑布局：无额外 padding，充分利用面板空间

**当前问题**：
- panel 使用 `padding: 16px`，导致边距
- 颜色值与 Chrome DevTools 不一致
- 字体栈使用 `system-ui`，不够精确

## Goals / Non-Goals

**Goals:**
- 移除面板边距，充分利用 DevTools 面板空间
- 使用 Chrome DevTools 原生配色方案
- 使用 Chrome DevTools 原生字体栈
- 深色/浅色主题精确匹配 Chrome DevTools

**Non-Goals:**
- 不重新设计组件布局
- 不添加新的主题选项
- 不修改功能逻辑

## Decisions

### 1. 颜色方案：Chrome DevTools 标准

**浅色主题颜色值**：
```css
--bg-primary: #ffffff
--bg-secondary: #f3f3f3
--border-color: #d0d0d0
--text-primary: #333333
```

**深色主题颜色值**：
```css
--bg-primary: #1e1e1e
--bg-secondary: #252526
--border-color: #3c3c3c
--text-primary: #e0e0e0
```

### 2. 字体栈：Chrome DevTools 原生

```css
font-family: 
  '.SFNSDisplay-Regular',    /* macOS Chrome */
  'Helvetica Neue',
  'Lucida Grande',
  'Segoe UI',                /* Windows */
  'Roboto',                  /* Android/Chrome OS */
  'Ubuntu',                  /* Ubuntu */
  'Cantarell',               /* GNOME */
  sans-serif;
font-size: 11px;             /* DevTools 使用较小字体 */
```

### 3. 边距处理：移除 panel padding

**变更**：
- 移除 `.panel { padding: 16px }`
- 组件内部使用微调间距（8px）

**理由**：
- DevTools 面板空间有限，应充分利用
- 原生 DevTools 面板无额外边距

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 不同平台字体显示差异 | 使用平台特定字体 fallback |
| 深色模式颜色值可能有细微差异 | 参考 Chrome DevTools 源码最新值 |
| 移除边距后组件可能过于紧凑 | 组件内部保持合理间距 |