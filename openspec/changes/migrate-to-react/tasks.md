## 1. 准备阶段 - 依赖迁移

- [x] 1.1 移除 Vue 相关依赖 (vue, vue-i18n, @wxt-dev/module-vue)
- [x] 1.2 添加 React 核心依赖 (react, react-dom)
- [x] 1.3 添加 React 类型依赖 (@types/react, @types/react-dom)
- [x] 1.4 添加 React i18n 依赖 (react-i18next, i18next)
- [x] 1.5 添加 WXT React 模块 (@wxt-dev/module-react)
- [x] 1.6 更新 wxt.config.ts 配置（移除 Vue 模块，添加 React 模块）
- [x] 1.7 更新 tsconfig.json 支持 JSX

## 2. React 入口文件重构

- [x] 2.1 删除 App.vue 文件
- [x] 2.2 删除 index.ts (Vue 入口)
- [x] 2.3 创建 main.tsx (React 入口)
- [x] 2.4 创建 App.tsx 主组件
- [x] 2.5 创建 App.module.css 样式文件

## 3. React Hooks 实现

- [x] 3.1 创建 hooks/useNetworkListener.ts Hook
- [x] 3.2 创建 hooks/useStats.ts Hook
- [x] 3.3 创建 hooks/useConfig.ts Hook
- [x] 3.4 创建 hooks/useTheme.ts Hook
- [x] 3.5 创建 hooks/useLocale.ts Hook

## 4. React 组件实现

- [x] 4.1 创建 components/StatusBar.tsx 组件
- [x] 4.2 创建 components/StatsSection.tsx 组件
- [x] 4.3 创建 components/MediaTabs.tsx 组件
- [x] 4.4 创建 components/MediaList.tsx 组件
- [x] 4.5 创建 components/ConfigSection.tsx 组件
- [x] 4.6 创建 components/LanguageSelect.tsx 组件
- [x] 4.7 创建 components/ThemeSelect.tsx 组件

## 5. i18n 配置迁移

- [x] 5.1 更新 i18n.ts 使用 react-i18next 配置
- [x] 5.2 确保 locales/zh.json 和 en.json 格式兼容
- [x] 5.3 在 main.tsx 中初始化 i18n

## 6. 样式迁移

- [x] 6.1 将 Vue scoped CSS 转换为 CSS Modules
- [x] 6.2 确保 CSS 变量定义的暗黑模式正常工作
- [x] 6.3 为每个组件创建对应的 .module.css 文件

## 7. 测试与验证

- [x] 7.1 运行 pnpm build 验证构建成功
- [x] 7.2 测试 DevTools 面板正常渲染
- [x] 7.3 测试媒体捕获功能正常
- [x] 7.4 测试统计数据显示正常
- [x] 7.5 测试配置保存/恢复正常
- [x] 7.6 测试语言切换功能正常
- [x] 7.7 测试主题切换功能正常
- [x] 7.8 打包生产版本并验证