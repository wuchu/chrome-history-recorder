## Context

当前 `ClassifyProgressSection` 组件位于 `packages/extension/src/entrypoints/media-browser/components/`，使用自定义 CSS 模块样式和纯文本按钮。项目已集成 antd 6.4.3 和 @ant-design/icons 6.2.5，且 `StatusBar.tsx` 已在使用这些组件，可作为参考。

数据来源：
- `useClassifyQueue` hook 提供 `ClassifyQueueStatus` 包含 `pending`、`processing`、`completed`、`failed`、`total` 和 `scheduler` 状态
- `scheduler.running` 布尔值指示调度器是否运行中

## Goals / Non-Goals

**Goals:**
- 重构 `ClassifyProgressSection` 为单行紧凑布局
- 使用 antd `Progress` 组件显示进度（`size="small"`）
- 使用 antd `Button` 组件（`size="small"`, `type="text"`）和 `@ant-design/icons`
- 使用 antd `Tooltip` 包裹按钮提供提示文字
- 进度条状态和颜色根据队列状态动态变化

**Non-Goals:**
- 不改变 `useClassifyQueue` hook 的逻辑
- 不修改 Background Service Worker 的消息协议
- 不改变 Options 页面的分类控件

## Decisions

### Decision 1: 使用 Ant Design Progress 组件
**选择**: 使用 `antd` 的 `Progress` 组件，`size="small"`
**替代方案**: 自定义进度条
**理由**: 项目已在用 antd，一致性更好；组件自带动画和状态支持

### Decision 2: 进度条状态映射
**选择**:
- 运行中 → `status="active"`, color=success green
- 已暂停 → `status="normal"`, color=default blue
- 有错误 → `status="exception"`, color=error red
**理由**: antd 标准状态，用户熟悉

### Decision 3: 图标按钮选择
**选择**: 使用以下 `@ant-design/icons`:
- `RobotOutlined` - AI 分类标签
- `PlayCircleOutlined` - 开始
- `PauseCircleOutlined` - 暂停
- `ReloadOutlined` - 重试失败
- `DeleteOutlined` - 清空队列
**理由**: 与 `StatusBar.tsx` 保持一致的图标风格

### Decision 4: 保持现有 CSS Modules 结构
**选择**: 继续使用 `ClassifyProgressSection.module.css`，但简化样式以适应紧凑布局
**理由**: 避免大幅重构，保持现有主题支持

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| antd 组件样式与现有 DevTools 风格不匹配 | 使用 `type="text"` 按钮减少视觉干扰，通过 CSS Modules 调整 |
| 小图标按钮可访问性问题 | 始终用 `Tooltip` 包裹，确保有文字提示 |

## Migration Plan

1. 修改 `ClassifyProgressSection.tsx`，导入 antd 组件和图标
2. 更新 JSX 结构为单行布局
3. 更新 CSS 模块样式
4. 测试：验证运行中/暂停/有错误状态都正确显示
5. 测试：验证按钮功能正常

## Open Questions

无 - 设计已明确，直接实施即可
