## Why

当前系统只支持单一 `category` 分类，且分类标签是硬编码的，无法满足用户灵活管理和组织媒体文件的需求。用户希望能够自定义标签集合、支持多标签分类，并通过标签 Tab 快速过滤浏览。

## What Changes

- 在 Options 页面新增**标签管理**功能，用户可添加、编辑、删除、排序自定义标签
- 将单一 `category` 字段改造为 `system_tags` 和 `user_tags` 两个字段，支持多标签
- AI 分类器改为从用户预定义的标签集合中选择 1-3 个标签
- DevTools Panel 新增**可滚动标签 Tab 栏**，支持按标签过滤媒体
- 自动生成系统标签（📷 图片、🎬 视频、⭐ 已收藏、未分类），不可删除
- 标签 Tab 栏只显示有文件的标签，始终保留"全部"Tab

## Capabilities

### New Capabilities

- `tag-management`: 用户在 Options 页面管理自定义标签集合
- `multi-tag-filtering`: 在 DevTools Panel 通过标签 Tab 过滤媒体文件
- `system-tags`: 自动生成并维护不可修改的系统标签

### Modified Capabilities

- `ollama-classifier`: AI 分类器改为从用户预定义标签中选择，并支持多标签输出
- `devtools-media-grid`: 媒体网格上方添加可滚动标签 Tab 栏

## Impact

- **packages/extension**: ExtensionConfig 类型扩展，Options 页面新增标签管理 UI，DevTools Panel 改造 MediaTabs 组件
- **packages/vfs-service**: 支持新的标签字段，新增按标签过滤 API（或扩展现有 listFiles）
- **packages/extension**: Extension Background 分类器 prompt 更新，结果解析支持多标签
