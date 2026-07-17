## Context

当前项目已有完整的文件删除后端功能：
- `FileManager.handleDeleteFile(hash, hard)` 方法
- Background 消息处理器 `deleteFile`
- `file:deleted` 事件广播

前端部分：
- `MasonryItem` 组件：显示缩略图，点击打开详情
- `MediaDetail` 组件：显示大图/视频预览，有关闭按钮
- `useCombinedMedia` hook：合并历史和实时捕获的媒体
- 已有国际化机制（`locales/en.json`, `locales/zh.json`）

## Goals / Non-Goals

**Goals:**
- 在 MasonryItem 右上角添加删除按钮（悬停显示）
- 在 MediaDetail 工具栏添加删除按钮
- 实现删除确认对话框（使用浏览器原生 confirm）
- 完善 useCombinedMedia 以监听 file:deleted 事件
- 适配深色/浅色主题

**Non-Goals:**
- 不实现批量删除功能
- 不实现软删除/回收站功能
- 不修改后端删除逻辑

## Decisions

### Decision 1: 使用浏览器原生 confirm 对话框
**Rationale**: 简单、一致，无需引入额外依赖。项目其他部分也使用原生 confirm。

**Alternatives considered**:
- 自定义 React 模态框：过度设计，增加复杂度
- 直接删除不确认：可能导致误操作

### Decision 2: 删除按钮悬停显示（MasonryItem）
**Rationale**: 保持界面简洁，不干扰正常浏览。

**Alternatives considered**:
- 始终显示：界面显得杂乱
- 长按触发：移动端友好但不适合该扩展

### Decision 3: 删除按钮点击阻止事件冒泡
**Rationale**: 删除按钮是缩略图按钮的子元素，点击删除不应触发打开详情。

**Alternatives considered**:
- 改变 DOM 结构：可能影响现有布局和样式

### Decision 4: 同时支持两处删除（缩略图 + 详情）
**Rationale**: 提供灵活的操作方式，用户可以根据场景选择。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 误删除 | 使用 confirm 对话框确认 |
| 删除后 UI 状态不同步 | 监听 file:deleted 事件并统一处理 |
| 按钮样式与主题不一致 | 使用项目已有的 CSS 变量（--error-color） |

## Open Questions

无 - 所有设计决策已明确。
