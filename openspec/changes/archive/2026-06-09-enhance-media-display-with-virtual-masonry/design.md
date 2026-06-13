# Design: Enhance Media Display with Virtual Masonry

## Context

### 当前架构

```
DevTools Panel
├── App.tsx
│   ├── useWebSocket() → WebSocket events (file:captured, classify:*)
│   ├── useNetworkListener() → NetworkListener.capturedImages (实时捕获)
│   └── useCapturedFiles() → 从 WebSocket events 提取文件列表
│
├── MediaGrid.tsx
│   └── {items.map(...)} → 渲染所有项目 (无虚拟化)
│
└── 问题:
    ├── 不调用 /images API → 不显示历史图片
    ├── 渲染所有 DOM → 815 个节点 → 性能问题
    └── 分类状态只在项目徽章显示 → 无全局概览
```

### Proxy 数据

- 存储路径: `~/Downloads/chrome-history/`
- 总计: 815 个媒体文件
- 缩略图: `.thumbnails/{hash}_100.webp`
- AI Classify 插件: `/classify/status` API

## Goals / Non-Goals

**Goals:**
- 历史图片分页加载 (50/页)
- Masonry 虚拟网格 (动态高度)
- 分类进度独立 Section
- WebSocket 实时数据合并

**Non-Goals:**
- 不改变分类逻辑
- 不实现编辑功能

## Decisions

### 决定 1: 虚拟化方案 - @virtuoso.dev/masonry

**方案对比:**

| 方案 | 优点 | 缺点 |
|------|------|------|
| @tanstack/react-virtual | 灵活，通用 | Masonry 支持复杂 |
| @virtuoso.dev/masonry | 专为 Masonry 设计 | 依赖额外包 |
| react-photo-album | 图片优化布局 | 需预知尺寸 |
| 自建方案 | 完全控制 | 复杂度高 |

**选择**: `@virtuoso.dev/masonry`
- 来自 react-virtuoso 团队，成熟稳定
- 原生支持 Masonry + 虚拟化
- 支持无限滚动 (endReached)
- 支持动态高度测量
- 响应式列数

```tsx
<VirtuosoMasonry
  data={items}
  columnCount={4}
  ItemContent={(index, item) => <MasonryItem item={item} />}
  endReached={() => loadMore()}
/>
```

### 决定 2: 数据合并策略

**数据来源:**

1. **历史数据**: `GET /images?limit=50&offset=0&order=desc`
   - 初始化加载
   - 无限滚动追加

2. **实时数据**: WebSocket events
   - `file:captured` → 新文件插入顶部
   - `classify:*` → 更新分类状态

**合并逻辑:**

```typescript
function useCombinedMedia({ historical, wsCaptured, wsClassify }) {
  return useMemo(() => {
    // 1. WebSocket 新文件插入顶部（去重）
    const newItems = wsCaptured
      .filter(file => !historical.some(h => h.hash === file.hash))
      .map(file => ({
        ...file,
        classifyStatus: wsClassify[file.hash]?.status || 'pending',
      }));

    // 2. 历史数据（带分类状态更新）
    const historyWithUpdates = historical.map(item => ({
      ...item,
      classifyStatus: wsClassify[item.hash]?.status || item.classifyStatus,
    }));

    // 3. 合并: 新文件在最前面
    return [...newItems, ...historyWithUpdates];
  }, [historical, wsCaptured, wsClassify]);
}
```

### 决定 3: Proxy /images API 扩展

**新增参数:**
- `limit`: number (默认 50)
- `offset`: number (默认 0)
- `order`: 'asc' | 'desc' (默认 'desc')

**新增返回字段:**
- `mimeType`: 从文件扩展名推断
- `thumbnailUrl`: `/images/:hash/thumbnail?size=200`
- `total`: 总数
- `hasMore`: 是否还有更多

### 决定 4: 响应式列数

**列数策略:**

| 宽度范围 | 列数 |
|----------|------|
| < 500px | 2 |
| 500-800px | 3 |
| 800-1100px | 4 |
| > 1100px | 5 |

**列宽**: 200px + gap 10px

**实现: ResizeObserver 监听容器宽度**

### 决定 5: 缩略图尺寸

**新增尺寸:**
- small: 100px (现有)
- medium: 200px (新增，Masonry 列宽)
- large: 400px (现有)

**生成策略:**
- 宽度固定 200px
- 高度自适应 (fit: 'inside')
- 格式: webp

### 决定 6: ClassifyProgressSection 位置

**位置**: 在 StatsSection 和 MediaTabs 之间

**内容:**
- 进度条 (completed/total)
- 队列统计 (pending, processing, completed, failed)
- 分类配置显示

## Risks / Trade-offs

### Risk 1: Masonry 动态高度测量延迟

**问题**: 图片加载前不知道高度 → 位置跳跃

**Mitigation**: @virtuoso.dev/masonry 内置动态测量，有 `itemHeight` 估算参数

### Risk 2: WebSocket 与历史数据竞态

**问题**: 新文件可能在历史加载前就通过 WebSocket 收到

**Mitigation**: 合并时按 hash 去重

### Risk 3: 缩略图加载性能

**问题**: 大量缩略图同时加载可能卡顿

**Mitigation**: 
- VirtuosoMasonry 只渲染可见项
- `<img loading="lazy">` 属性
- 缩略图缓存 (Proxy 已有 ETag)

### Trade-off: 固定列宽 vs 自适应列宽

**选择固定列宽 (200px)**:
- 虚拟化计算更稳定
- 缩略图可以预生成
- 高度自适应保持比例

**放弃自适应列宽**:
- 实现复杂
- 需要实时生成缩略图

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Proxy Server                                │
│                                                                     │
│  GET /images?limit=50&offset=0&order=desc                          │
│  ├── 返回: items[], total, hasMore                                 │
│  ├── 字段: hash, mimeType, thumbnailUrl, ...                       │
│  └── 改动: server.ts                                                │
│                                                                     │
│  GET /images/:hash/thumbnail?size=200                              │
│  ├── 新增 size=200 支持                                            │
│  └── 改动: routes/thumbnail.ts                                     │
│                                                                     │
│  GET /classify/status                                              │
│  └── 现有，返回队列状态                                             │
│                                                                     │
│  WebSocket /events                                                 │
│  └── 现有，file:captured, classify:*                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DevTools Panel                              │
│                                                                     │
│  App.tsx                                                           │
│  ├── useHistoricalImages() → 历史数据加载                           │
│  ├── useClassifyQueue() → 分类队列状态                             │
│  ├── useWebSocket() → 实时事件                                     │
│  ├── useCombinedMedia() → 数据合并                                 │
│  └── useColumnCount() → 响应式列数                                 │
│                                                                     │
│  ClassifyProgressSection                                           │
│  └── 进度条 + 队列统计                                              │
│                                                                     │
│  VirtualMasonryGrid                                                │
│  ├── VirtuosoMasonry (from @virtuoso.dev/masonry)                  │
│  ├── endReached → loadMore                                        │
│  └── MasonryItem 渲染                                              │
│                                                                     │
│  MasonryItem                                                       │
│  ├── 缩略图 (200px)                                                │
│  ├── StatusBadge                                                  │
│  └── 分类信息                                                      │
└─────────────────────────────────────────────────────────────────────┘
```