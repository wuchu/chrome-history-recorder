## Why

Chrome DevTools 用户可能使用不同语言环境（中文/英文），且 DevTools 本身支持暗黑模式。当前扩展 UI 使用固定中文文本和固定亮色样式，无法适应不同用户的偏好和 DevTools 主题设置，影响用户体验。

## What Changes

- **国际化支持**: 添加中英文双语支持，根据 Chrome 语言设置自动切换
- **暗黑模式**: 支持 DevTools 暗黑主题，自动跟随 DevTools 主题设置
- **语言切换**: 在面板中提供语言切换选项，允许用户手动选择语言
- **主题切换**: 在面板中提供主题切换选项，支持亮色/暗色/自动跟随

## Capabilities

### New Capabilities

- `i18n-support`: 国际化支持，中英文切换，自动检测浏览器语言
- `dark-mode-support`: 暗黑模式支持，跟随 DevTools 主题或手动切换

### Modified Capabilities

- `image-capture-extension`: UI 文本国际化，样式支持暗黑模式

## Impact

- **扩展代码**:
  - App.vue 添加国际化逻辑和暗黑模式样式
  - 新增语言配置文件（locales/zh.json, locales/en.json）
  - 使用 Chrome i18n API 或 Vue i18n
- **样式修改**: CSS 变量支持亮色/暗色主题切换
- **配置**: 面板增加语言和主题切换 UI