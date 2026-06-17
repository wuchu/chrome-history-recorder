## Context

当前系统标签的实现存在架构不一致性：
- 后端 listFiles 中，对 "image"、"video"、"starred"、"uncategorized" 有特殊的查询逻辑（检查 mime_type、is_starred 等字段）
- 后端 getTagCounts 中，同样通过检查 mime_type、is_starred 等字段来统计
- 前端 getSystemTagsForFile 动态计算系统标签，而不是从数据库读取
- 存在未使用的死代码 MediaTabs.tsx（已被 ScrollableTabBar 替代）

## Goals / Non-Goals

**Goals:**
- 统一标签架构：所有标签（系统标签和用户标签）统一存储在 tags 字段中，使用 "system:" 前缀区分
- 简化查询逻辑：移除特殊 case，所有标签查询统一检查 tags 字段
- 简化统计逻辑：移除特殊 case，所有标签统计统一从 tags 字段计数
- 清理死代码：删除未使用的 MediaTabs 组件

**Non-Goals:**
- 不改变外部 API 接口
- 不改变用户可见的 UI 行为
- 不改变标签的显示方式（"image" 而不是 "system:image"）

## Decisions

### Decision 1: System tags use "system:" prefix in database
**选项考虑：**
- A. 使用 "system:image"、"system:video" 等带前缀的标签名 ✓
- B. 继续使用不带前缀的 "image"、"video"

**选择 A 的理由：**
- 清晰区分系统标签和用户标签
- 避免命名冲突（用户也可能想创建名为 "image" 的标签）
- 当前的 tag-utils.ts 中的 SYSTEM_TAGS 已经定义了 id 为 "system:image"

### Decision 2: Add system tags at save time
**选项考虑：**
- A. 保存文件时立即添加系统标签 ✓
- B. 延迟添加，在查询时动态计算
- C. 后台任务批量添加

**选择 A 的理由：**
- 数据一致性更好
- 查询性能更好（不需要动态计算）
- syncBlobsToIndex 也需要处理已存在的文件

### Decision 3: Simplify listFiles to query tags field directly
**选项考虑：**
- A. 移除所有特殊 case，统一查询 tags 字段 ✓
- B. 保留特殊 case 作为性能优化

**选择 A 的理由：**
- 代码更简洁，更易维护
- 逻辑更一致
- 有 JSON 索引的情况下性能足够好

### Decision 4: Simplify getTagCounts to count tags field directly
**选项考虑：**
- A. 移除所有特殊 case，统一从 tags 字段统计 ✓
- B. 保留特殊 case 作为性能优化

**选择 A 的理由：**
- 代码更简洁，更易维护
- 逻辑更一致
- 性能可接受

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 迁移期间已有文件缺少系统标签 | 高 | 中 | syncBlobsToIndex 会为已存在的文件添加系统标签 |
| tags 字段数据量增加 | 低 | 低 | 系统标签数量很少（4个），影响可忽略 |
| 查询性能轻微下降 | 低 | 低 | JSON 查询有索引支持，性能足够 |

## Migration Plan

1. 修改 `saveFile()`，保存新文件时自动添加系统标签
2. 修改 `syncBlobsToIndex()`，为已存在的文件添加系统标签
3. 简化 `listFiles()`，移除特殊 case，统一查询 tags 字段
4. 简化 `getTagCounts()`，移除特殊 case，统一从 tags 字段统计
5. 删除 MediaTabs.tsx 和 MediaTabs.module.css
6. 前端简化过滤逻辑（可选的后续优化）

**回滚策略：** Git revert 可完整回滚

## Open Questions

无
