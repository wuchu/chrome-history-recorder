## Context

当前 ai-classify 支持三种文件类型：
- 图片: jpg, jpeg, png, gif, webp, bmp (使用 vision model)
- 视频: mp4 (使用 vision model + ffmpeg 提取帧)
- 文本: txt, md, pdf (使用 text model)

实际使用场景仅需要图片和视频处理，文本处理带来不必要的复杂度。

## Goals / Non-Goals

**Goals:**
- 简化代码，移除文本处理逻辑
- 非媒体文件不进入队列，直接跳过
- 配置简化：移除 textModel 和 txtCategories

**Non-Goals:**
- 不改变图片/视频处理逻辑
- 不改变输出目录结构
- 不改变分类结果格式

## Decisions

### 文件类型过滤位置

**决策**: 在 watcher 层过滤，而非 classifier 层

**理由**:
- 更早过滤 = 队列更干净
- 避免无意义的 Task 创建和 hash 计算
- classifier 只处理有效文件，职责更清晰

**备选方案**: 在 classifier 返回特殊结果
- 缺点: 仍会创建 Task，占用队列空间和索引记录

### 跳过行为

**决策**: 直接跳过，不记录任何信息

**理由**:
- 用户明确要求"无视它"
- 不需要追踪哪些文件被跳过
- 日志中已有 "File detected" 可用于调试

## Risks / Trade-offs

**风险**: 用户可能有文本文件在 input 目录
→ **缓解**: 这些文件将被静默跳过，不影响图片/视频处理

**风险**: 配置文件中有 textModel 字段
→ **缓解**: 配置合并时忽略未知字段，不会报错