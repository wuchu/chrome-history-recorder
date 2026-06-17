## Why

当前系统标签的实现存在架构不一致性：系统标签（image、video、starred、uncategorized）是根据 mime_type 等字段动态计算的，而不是作为真实标签存储在数据库的 tags 字段中。这导致后端查询逻辑有大量特殊 case，前端过滤逻辑复杂，代码难以维护。

## What Changes

- **后端**：保存文件时自动将系统标签（"system:image"、"system:video"、"system:starred"、"system:uncategorized"）持久化到 tags 字段
- **后端**：syncBlobsToIndex 时为已存在的文件添加系统标签
- **后端**：简化 listFiles 查询逻辑，移除特殊 case，统一从 tags 字段查询
- **后端**：简化 getTagCounts 统计逻辑，移除特殊 case，统一从 tags 字段统计
- **前端**：简化过滤逻辑，直接从 tags 字段读取而非动态计算
- **删除**：移除死代码 MediaTabs.tsx 和 MediaTabs.module.css（已被 ScrollableTabBar 替代）

## Capabilities

### New Capabilities
- `unified-system-tags-architecture`：统一系统标签架构，所有标签统一存储和查询

### Modified Capabilities
- `system-tags`：更新系统标签的实现方式，从动态计算改为持久化存储
- `vfs-service`：简化 VFS 服务的查询和统计逻辑

## Impact

- 受影响代码：
  - `packages/vfs-service/src/api.ts`（saveFile、syncBlobsToIndex）
  - `packages/vfs-service/src/sqlite.ts`（listFiles、getTagCounts）
  - `packages/extension/src/shared/tag-utils.ts`（简化）
  - `packages/extension/src/entrypoints/sidepanel/App.tsx`（简化过滤逻辑）
  - 删除：`packages/extension/src/entrypoints/media-browser/components/MediaTabs.tsx`
  - 删除：`packages/extension/src/entrypoints/media-browser/components/MediaTabs.module.css`
- 无破坏性变更：外部 API 保持不变，只是内部实现优化
