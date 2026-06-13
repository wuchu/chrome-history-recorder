# Tasks: Enhance Media Display with Virtual Masonry

## Phase 1: Proxy API 扩展 (后端)

### 1.1 GET /images API 扩展

- [x] 1.1.1 添加分页参数 `limit`, `offset`, `order`
- [x] 1.1.2 从文件扩展名推断 `mimeType`
- [x] 1.1.3 生成 `thumbnailUrl` 字段 (`/images/:hash/thumbnail?size=200`)
- [x] 1.1.4 添加 `total`, `hasMore` 返回字段
- [x] 1.1.5 实现按时间倒序排列 (`order=desc`)
- [ ] 1.1.6 测试 API 返回格式

### 1.2 缩略图尺寸扩展

- [x] 1.2.1 SIZE_MAP 添加 `medium: 200`
- [ ] 1.2.2 测试 size=200 缩略图生成

---

## Phase 2: Extension Hooks (前端)

### 2.1 useHistoricalImages hook

- [x] 2.1.1 创建 `hooks/useHistoricalImages.ts`
- [x] 2.1.2 实现 GET /images API 调用
- [x] 2.1.3 实现分页管理 (offset 状态)
- [x] 2.1.4 实现加载状态管理
- [x] 2.1.5 实现 loadMore 函数
- [x] 2.1.6 实现 refresh 函数
- [x] 2.1.7 编写 TypeScript 类型定义

### 2.2 useClassifyQueue hook

- [x] 2.2.1 创建 `hooks/useClassifyQueue.ts`
- [x] 2.2.2 实现 GET /classify/status 调用
- [x] 2.2.3 集成 WebSocket classify:* 事件监听
- [x] 2.2.4 实现状态实时更新
- [x] 2.2.5 编写 TypeScript 类型定义

### 2.3 useCombinedMedia hook

- [x] 2.3.1 创建 `hooks/useCombinedMedia.ts`
- [x] 2.3.2 实现历史数据 + WebSocket 数据合并逻辑
- [x] 2.3.3 实现新文件顶部插入
- [x] 2.3.4 实现分类状态更新
- [x] 2.3.5 实现 hash 去重
- [x] 2.3.6 编写 TypeScript 类型定义

### 2.4 useColumnCount hook

- [x] 2.4.1 创建 `hooks/useColumnCount.ts`
- [x] 2.4.2 实现 ResizeObserver 监听容器宽度
- [x] 2.4.3 实现响应式列数计算逻辑
- [x] 2.4.4 清理 ResizeObserver on unmount

---

## Phase 3: Extension Components (前端)

### 3.1 ClassifyProgressSection

- [x] 3.1.1 创建 `components/ClassifyProgressSection.tsx`
- [x] 3.1.2 实现进度条 UI (completed/total)
- [x] 3.1.3 实现队列统计展示 (pending, processing, completed, failed)
- [x] 3.1.4 实现分类配置显示 (model, language, style)
- [x] 3.1.5 创建 `ClassifyProgressSection.module.css`
- [x] 3.1.6 集成 useClassifyQueue hook

### 3.2 VirtualMasonryGrid

- [x] 3.2.1 创建 `components/VirtualMasonryGrid.tsx`
- [x] 3.2.2 安装依赖 `pnpm --filter extension add @virtuoso.dev/masonry`
- [x] 3.2.3 集成 VirtuosoMasonry 组件
- [x] 3.2.4 实现 endReached 无限滚动回调 (通过 onScroll 检测)
- [x] 3.2.5 集成 useColumnCount hook
- [x] 3.2.6 实现 MasonryItem 渲染
- [x] 3.2.7 创建 `VirtualMasonryGrid.module.css`

### 3.3 MasonryItem

- [x] 3.3.1 创建 `components/MasonryItem.tsx`
- [x] 3.3.2 实现缩略图渲染 (`<img loading="lazy">`)
- [x] 3.3.3 实现 StatusBadge 显示
- [x] 3.3.4 实现 category 标签显示
- [x] 3.3.5 实现 confidence 进度条
- [x] 3.3.6 实现点击事件处理
- [x] 3.3.7 创建 `MasonryItem.module.css`

### 3.4 App.tsx 改进

- [x] 3.4.1 整合 useHistoricalImages hook
- [x] 3.4.2 整合 useClassifyQueue hook
- [x] 3.4.3 整合 useCombinedMedia hook
- [x] 3.4.4 替换 MediaGrid → VirtualMasonryGrid
- [x] 3.4.5 添加 ClassifyProgressSection (在 StatsSection 后)
- [x] 3.4.6 传递必要的 props

### 3.5 StatusBar.tsx 改进

- [x] 3.5.1 移除 classifyQueue 显示 (移到 ClassifyProgressSection)

---

## Phase 4: 依赖与构建

### 4.1 添加依赖

- [x] 4.1.1 执行 `pnpm --filter extension add @virtuoso.dev/masonry`

### 4.2 TypeScript 类型

- [x] 4.2.1 在 `types.ts` 添加接口定义 (已集成到各 hooks)
- [x] 4.2.2 导出类型 (hooks/index.ts)

### 4.3 CSS 模块

- [x] 4.3.1 创建 `ClassifyProgressSection.module.css`
- [x] 4.3.2 创建 `VirtualMasonryGrid.module.css`
- [x] 4.3.3 创建 `MasonryItem.module.css`

---

## Phase 5: 测试验证

### 5.1 功能测试

- [ ] 5.1.1 测试 DevTools Panel 打开时加载历史图片
- [ ] 5.1.2 测试无限滚动加载更多
- [ ] 5.1.3 测试 WebSocket 新文件插入顶部
- [ ] 5.1.4 测试分类状态实时更新
- [ ] 5.1.5 测试点击项目打开详情

### 5.2 性能测试

- [ ] 5.2.1 测试 815 个图片渲染性能
- [ ] 5.2.2 检查滚动流畅度
- [ ] 5.2.3 检查 DOM 节点数量 (~15-25)

### 5.3 响应式测试

- [ ] 5.3.1 测试不同宽度下的列数变化
- [ ] 5.3.2 测试容器 resize 时重新布局

---

## Implementation Notes

### VirtuosoMasonry API 发现

VirtuosoMasonry 的正确用法：
```tsx
<VirtuosoMasonry
  data={items}           // 数据数组
  columnCount={4}        // 列数
  ItemContent={Component} // 渲染组件，接收 { data, index, context }
  initialItemCount={50}  // 初始渲染数量
/>
```

**注意**: VirtuosoMasonry 不支持 `endReached` prop。无限滚动需要通过外层 `onScroll` 检测实现。

### 预先存在的问题

以下编译错误是预先存在的，不是本次变更引入：
- CSS 模块类型声明缺失 (`Cannot find module './*.module.css'`)
- `defineBackground` 未定义
- `NodeJS` namespace 未找到
- `networkListener.ts` 类型问题