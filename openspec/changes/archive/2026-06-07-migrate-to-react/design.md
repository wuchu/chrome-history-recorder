## Context

当前 Chrome 扩展 DevTools 面板使用 Vue 3 + vue-i18n 构建，技术栈为：
- WXT 0.20+ 作为扩展开发框架
- Vue 3.4+ + Composition API
- vue-i18n 11+ 国际化
- @wxt-dev/module-vue 模块

项目需要将前端技术栈统一迁移至 React，保持所有功能不变。

## Goals / Non-Goals

**Goals:**
- 将 DevTools 面板完全重构为 React 18
- 保留所有现有功能（媒体捕获、统计、列表、配置、国际化、暗黑模式）
- 保持 Chrome Storage API 和 DevTools API 集成
- 保持 proxy 服务端不变（仅前端重构）
- 迁移后代码质量和性能不低于原版本

**Non-Goals:**
- 不改变 proxy 服务端实现
- 不添加新功能（仅技术栈迁移）
- 不改变 UI 设计和用户体验
- 不改变 manifest.json 配置

## Decisions

### 1. React 版本选择

**决定**: 使用 React 18.3+

**理由**:
- React 18 支持 Concurrent Features，性能更好
- Hooks API 更成熟，与 Vue Composition API 模式相似
- 自动批处理更新，减少不必要的重渲染

### 2. 国际化方案选择

**决定**: 使用 react-i18next

**理由**:
- i18next 是成熟的国际化库，React 支持完善
- 与现有 JSON 翻译文件格式兼容
- 支持 Suspense 模式，加载体验更好

**备选方案**: 直接使用 Chrome i18n API - 需要预定义 manifest 语言，切换不灵活

### 3. 状态管理方案

**决定**: 使用 React Hooks (useState + useEffect)

**理由**:
- 当前 Vue 应用状态较简单，不需要 Redux 等复杂状态管理
- useState + useEffect 模式与 Vue Composition API 的 ref + onMounted 模式相似
- 减少额外依赖，保持代码简洁

**备选方案**: Zustand - 轻量但会增加额外学习成本

### 4. WXT React 模块

**决定**: 使用 @wxt-dev/module-react

**理由**:
- WXT 官方支持 React 模块
- 自动配置 React 构建，无需手动设置 Vite
- 与现有 WXT 项目结构兼容

### 5. 样式方案

**决定**: 保持 CSS Scoped 样式，使用 CSS Modules

**理由**:
- React 支持 CSS Modules，与 Vue scoped 样式效果相似
- CSS 变量定义的主题系统无需改动
- 减少迁移工作量

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| React 版本兼容问题 | 使用最新稳定版 React 18.3 |
| 国际化切换延迟 | react-i18next 支持 Suspense，可预加载 |
| DevTools 面板加载性能 | 使用 React.lazy 懒加载非关键组件 |
| WXT React 模块稳定性 | WXT 0.20+ 官方支持，文档完善 |

## Architecture

```
extension/src/
├── entrypoints/
│   └── devtools-panel/
│       ├── App.tsx           # React 主组件
│       ├── App.module.css    # CSS Modules 样式
│       ├── main.tsx          # React 入口
│       ├── i18n.ts           # react-i18next 配置
│       └── locales/
│       │   ├── zh.json       # 中文翻译（不变）
│       │   └── en.json       # 英文翻译（不变）
│       └── hooks/
│       │   ├── useNetworkListener.ts  # 网络监听 Hook
│       │   ├── useStats.ts            # 统计数据 Hook
│       │   └── useConfig.ts           # 配置管理 Hook
│       └── components/
│       │   ├── StatusBar.tsx
│       │   ├── StatsSection.tsx
│       │   ├── MediaTabs.tsx
│       │   ├── MediaList.tsx
│       │   └── ConfigSection.tsx
└── utils/
    └── networkListener.ts    # 保持不变
```

## Migration Plan

### Phase 1: 准备阶段
1. 移除 Vue 相关依赖
2. 添加 React 相关依赖
3. 配置 WXT React 模块

### Phase 2: 重构阶段
1. 创建 React 入口文件
2. 实现 React Hooks 抽取逻辑
3. 创建 React 组件替代 Vue 组件
4. 配置 react-i18next

### Phase 3: 测试验证
1. 构建验证
2. 功能测试（所有功能与原版本一致）
3. 性能测试（加载速度、响应速度）