## Why

用户无法直接从媒体浏览器 UI 删除不需要的图片或视频。虽然后端已实现删除功能，但前端缺少删除按钮的交互入口，导致用户体验不完整。

## What Changes

- 在 `MasonryItem` 缩略图右上角添加删除按钮（悬停时显示）
- 在 `MediaDetail` 大图预览工具栏添加删除按钮
- 增加删除确认对话框（可选，防止误操作）
- 完善 `useCombinedMedia` hook 以监听 `file:deleted` 事件并从列表移除该项
- 增加国际化翻译文本

## Capabilities

### New Capabilities

### Modified Capabilities
- `side-panel-media-browser`: 添加媒体项删除功能到 UI
- `extension-file-manager`: 从前端调用已有的删除功能（已有 spec，无需变更）

## Impact

- 受影响文件：`MasonryItem.tsx`, `MasonryItem.module.css`, `MediaDetail.tsx`, `MediaDetail.module.css`, `useCombinedMedia.ts`, `locales/en.json`, `locales/zh.json`
- 无破坏性变更，仅新增功能
