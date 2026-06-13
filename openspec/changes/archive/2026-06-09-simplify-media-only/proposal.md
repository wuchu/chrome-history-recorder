## Why

当前 ai-classify 支持图片、视频和文本三种文件类型，但实际使用场景仅需处理图片和视频。文本处理增加了不必要的复杂度：额外的模型配置、分类逻辑、以及队列中的无用记录。

## What Changes

- **BREAKING**: 移除文本文件处理逻辑
- 非图片/视频文件将被跳过，不进入任务队列
- 移除 `textModel` 配置项
- 移除 `txtCategories` 配置项
- 移除 `--ollama-text-model` CLI 选项

## Capabilities

### New Capabilities

无新增能力。

### Modified Capabilities

- `classifier`: 移除文本分类能力，仅支持图片和视频分类
- `watcher`: 新增文件类型过滤，非媒体文件直接跳过

## Impact

| 文件 | 变更 |
|------|------|
| `types.ts` | 移除 `textModel`, `txtCategories` 字段 |
| `classifier.ts` | 移除 `TEXT_EXTENSIONS`, `classifyText`, `isText` |
| `watcher.ts` | 添加媒体文件类型检查，跳过非媒体文件 |
| `config.ts` | 移除 txtCategories 相关合并逻辑 |
| `cli.ts` | 移除 `--ollama-text-model` CLI 选项 |