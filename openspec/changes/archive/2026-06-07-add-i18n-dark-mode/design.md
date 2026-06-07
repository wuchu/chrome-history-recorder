## Context

当前 Chrome 扩展 DevTools 面板：
- 使用固定中文文本，无国际化支持
- 使用固定亮色样式，不支持暗黑模式
- DevTools 本身支持暗黑主题，但扩展未适配

Chrome/i18n API 提供了语言检测能力，DevTools API 可检测当前主题。

## Goals / Non-Goals

**Goals:**
- 支持中英文双语切换
- 自动检测浏览器语言设置
- 支持 DevTools 暗黑模式
- 自动跟随或手动切换主题
- 用户可在面板中选择语言和主题偏好

**Non-Goals:**
- 不支持更多语言（仅中文和英文）
- 不支持自定义颜色配置
- 不影响代理服务端

## Decisions

### 1. 国际化方案：Chrome i18n API vs Vue i18n

**决定**: 使用 Vue i18n

**理由**:
- Vue i18n 更灵活，支持动态切换
- 与 Vue 组件集成更好
- Chrome i18n API 需要预定义 manifest 语言

**备选方案**: Chrome i18n API - 更原生但切换不灵活

### 2. 语言检测方案

**决定**: 使用 `chrome.i18n.getUILanguage()` 检测初始语言

**理由**:
- Chrome API 直接获取浏览器 UI 语言
- 可作为 Vue i18n 的默认语言设置

### 3. 主题检测方案

**决定**: 使用 CSS 媒体查询 `@media (prefers-color-scheme: dark)` + DevTools 主题检测

**理由**:
- DevTools 面板继承 DevTools 主题设置
- CSS 变量方式更简洁，无需 JavaScript 监听

**备选方案**: JavaScript 监听主题变化 - 更复杂

### 4. 主题实现方案

**决定**: CSS 变量 + 两套样式

**理由**:
- 简单直接，易于维护
- 支持 `prefers-color-scheme` 自动适配

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 语言文件维护成本 | 仅支持中英文，文件较小 |
| 主题切换可能有延迟 | 使用 CSS 变量，切换即时生效 |
| DevTools 主题检测不稳定 | 同时支持手动切换作为备选 |

## Architecture

```
extension/src/
├── locales/
│   ├── zh.json    # 中文翻译
│   └── en.json    # 英文翻译
├── entrypoints/
│   └── devtools-panel/
│       ├── App.vue     # 添加 i18n 和主题逻辑
│       └── i18n.ts     # i18n 配置
```