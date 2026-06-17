## Why

当前 AI 分类进度显示在一个独立的 `ClassifyProgressSection` 组件中，使用纯文字和大按钮，不够紧凑且占用较多垂直空间。用户希望在分类栏上方以更紧凑的方式显示整体进度，使用更小的图标按钮。

## What Changes

- 重构 `ClassifyProgressSection` 组件，使其更加紧凑
- 集成 Ant Design 的 `Progress` 组件（`size="small"`）显示分类进度
- 使用 Ant Design Icons 替换当前按钮（`PlayCircleOutlined`、`PauseCircleOutlined`、`ReloadOutlined`、`DeleteOutlined`）
- 使用 Ant Design 的 `Button` 组件（`size="small"`, `type="text"`）
- 使用 Ant Design 的 `Tooltip` 组件包裹按钮提供提示
- 进度条颜色和动画根据队列状态动态变化（运行中/暂停/有错误）

## Capabilities

### New Capabilities

- `classification-progress-display`: 在分类栏上方以紧凑单行布局显示 AI 分类进度

### Modified Capabilities

- `extension-classify-controls`: 更新要求，规定进度显示应使用紧凑的进度条和小图标按钮

## Impact

- 受影响文件：`packages/extension/src/entrypoints/media-browser/components/ClassifyProgressSection.tsx`
- 受影响文件：`packages/extension/src/entrypoints/media-browser/components/ClassifyProgressSection.module.css`
- 依赖：antd 6.4.3（已存在）、@ant-design/icons 6.2.5（已存在）
