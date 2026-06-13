# Spec: Virtual Masonry Grid

## Capability

实现虚拟化 Masonry 网格，用于高效展示大量媒体文件。

## Requirements

### REQ-1: 历史图片加载

- **REQ-1.1**: DevTools Panel 打开时自动调用 `GET /images?limit=50&offset=0&order=desc`
- **REQ-1.2**: 返回数据包含: `items`, `total`, `hasMore`
- **REQ-1.3**: 每个项目包含: `hash`, `filename`, `mimeType`, `thumbnailUrl`, `size`, `date`, `timestamp`
- **REQ-1.4**: 初始加载显示前 50 个历史图片
- **REQ-1.5**: 加载状态显示 loading indicator

### REQ-2: 无限滚动

- **REQ-2.1**: 滚动到底部时触发 `endReached` 回调
- **REQ-2.2**: 回调执行 `GET /images?limit=50&offset={currentOffset+50}`
- **REQ-2.3**: 新数据追加到现有列表末尾
- **REQ-2.4**: `hasMore === false` 时停止加载

### REQ-3: Masonry 布局

- **REQ-3.1**: 使用 `@virtuoso.dev/masonry` 组件
- **REQ-3.2**: 列宽固定 200px
- **REQ-3.3**: 项目高度自适应（保持原始比例）
- **REQ-3.4**: 列间距 10px
- **REQ-3.5**: 项目间距 10px

### REQ-4: 响应式列数

- **REQ-4.1**: 监听容器宽度变化 (ResizeObserver)
- **REQ-4.2**: 宽度 < 500px → 2 列
- **REQ-4.3**: 宽度 500-800px → 3 列
- **REQ-4.4**: 宽度 800-1100px → 4 列
- **REQ-4.5**: 宽度 > 1100px → 5 列

### REQ-5: 虚拟化渲染

- **REQ-5.1**: 只渲染可见区域的项目
- **REQ-5.2**: 滚动时动态加载/卸载项目
- **REQ-5.3**: 815 个图片时保持流畅 (< 50ms 响应)
- **REQ-5.4**: 约 15-25 个 DOM 节点在任何时刻

### REQ-6: 实时数据合并

- **REQ-6.1**: WebSocket `file:captured` 事件 → 新文件插入列表顶部
- **REQ-6.2**: WebSocket `classify:started` → 更新项目 status 为 'processing'
- **REQ-6.3**: WebSocket `classify:complete` → 更新项目 status, category, confidence, tags
- **REQ-6.4**: WebSocket `classify:failed` → 更新项目 status 为 'failed'
- **REQ-6.5**: 按 hash 去重，避免重复项

### REQ-7: 项目渲染

- **REQ-7.1**: 缩略图使用 `<img src={thumbnailUrl} loading="lazy" />`
- **REQ-7.2**: 显示 StatusBadge (pending/processing/completed/failed)
- **REQ-7.3**: 已分类项目显示 category 标签
- **REQ-7.4**: 已分类项目显示 confidence 进度条
- **REQ-7.5**: 点击项目打开 MediaDetail 面板

### REQ-8: 分类进度 Section

- **REQ-8.1**: 显示全局进度条 (completed / total)
- **REQ-8.2**: 显示队列统计: pending, processing, completed, failed
- **REQ-8.3**: 实时更新 (WebSocket classify:* 事件)
- **REQ-8.4**: 显示分类配置: model, language, style

## Interfaces

### HistoricalImagesAPI

```typescript
interface HistoricalImagesResponse {
  items: MediaItem[];
  total: number;
  hasMore: boolean;
}

interface MediaItem {
  hash: string;
  filename: string;
  mimeType: string;
  size: number;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO date
  thumbnailUrl: string;
  classifyStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  category?: string;
  confidence?: number;
  tags?: string[];
}
```

### useHistoricalImages Hook

```typescript
interface UseHistoricalImagesOptions {
  limit?: number; // default 50
  autoLoad?: boolean; // default true
}

interface UseHistoricalImagesReturn {
  items: MediaItem[];
  total: number;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}
```

### useClassifyQueue Hook

```typescript
interface ClassifyQueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

interface UseClassifyQueueReturn {
  status: ClassifyQueueStatus;
  config: {
    model: string;
    language: string;
    style: string;
  };
}
```

### useCombinedMedia Hook

```typescript
interface UseCombinedMediaOptions {
  historical: MediaItem[];
  wsCaptured: MediaItem[];
  wsClassify: Record<string, ClassifyEvent>;
}

interface UseCombinedMediaReturn {
  items: MediaItem[];
  newItemCount: number; // WebSocket 新增数量
}
```

### VirtualMasonryGrid Component

```typescript
interface VirtualMasonryGridProps {
  items: MediaItem[];
  onLoadMore?: () => void;
  onItemClick?: (item: MediaItem) => void;
  hasMore?: boolean;
  loading?: boolean;
}
```

### MasonryItem Component

```typescript
interface MasonryItemProps {
  item: MediaItem;
  onClick?: () => void;
}
```

### ClassifyProgressSection Component

```typescript
interface ClassifyProgressSectionProps {
  status: ClassifyQueueStatus;
  config: {
    model: string;
    language: string;
    style: string;
  };
}
```

## Error Handling

### ERR-1: API 加载失败

- **ERR-1.1**: 显示错误提示
- **ERR-1.2**: 提供重试按钮
- **ERR-1.3**: 不阻塞 WebSocket 数据显示

### ERR-2: 缩略图加载失败

- **ERR-2.1**: 显示占位图
- **ERR-2.2**: 不影响其他项目渲染

### ERR-3: WebSocket 断连

- **ERR-3.1**: 显示断连状态
- **ERR-3.2**: 自动重连 (现有 useWebSocket 已实现)
- **ERR-3.3**: 重连后历史数据仍然可用