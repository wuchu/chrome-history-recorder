## Why

当前 Chrome 扩展使用 Vue 3 作为 DevTools 面板的前端框架。团队希望统一技术栈，将前端框架迁移至 React，以便：
1. 与其他项目保持技术栈一致性，降低维护成本
2. 利用 React 更丰富的生态系统和社区资源
3. React Hooks 模式更符合现代前端开发趋势

## What Changes

- **BREAKING**: 将 DevTools 面板从 Vue 3 完全重构为 React 18
- 移除 vue-i18n，改用 react-i18next 实现国际化
- 移除 @wxt-dev/module-vue，改用 @wxt-dev/module-react
- 保留所有现有功能（媒体捕获、统计、配置、国际化、暗黑模式）
- 保持 Chrome Storage API 和 DevTools API 集成不变
- 保留 proxy 服务端不变（仅前端重构）

## Capabilities

### New Capabilities

- `react-ui`: React 18 DevTools 面板组件，使用 Hooks 模式管理状态
- `wxt-react-module`: WXT React 模块配置，替代 Vue 模块

### Modified Capabilities

- `image-capture-extension`: UI 实现从 Vue 重构为 React，功能需求不变
- `i18n-support`: 国际化实现从 vue-i18n 改为 react-i18next（需求不变）
- `dark-mode-support`: 主题切换逻辑从 Vue 响应式改为 React useState（需求不变）

## Impact

- **extension/package.json**: 移除 Vue 相关依赖，添加 React 相关依赖
- **wxt.config.ts**: 移除 Vue 模块，添加 React 模块
- **src/entrypoints/devtools-panel/**: 所有文件重构为 React 组件
  - `App.vue` → `App.tsx`
  - `index.ts` → React 入口文件
  - `i18n.ts` → react-i18next 配置
  - `locales/` → 翻译文件保持不变（仅改用 react-i18next 加载）
- **build 产物**: 大小可能略有变化，功能不变