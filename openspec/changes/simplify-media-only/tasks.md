## 1. types.ts 改造

- [x] 1.1 移除 `textModel` 字段
- [x] 1.2 移除 `txtCategories` 字段
- [x] 1.3 更新 `DEFAULT_CONFIG` 移除相关默认值

## 2. classifier.ts 改造

- [x] 2.1 移除 `TEXT_EXTENSIONS` 常量
- [x] 2.2 移除 `isText` 函数
- [x] 2.3 移除 `classifyText` 函数
- [x] 2.4 简化 `classifyFile` 函数，移除文本分支
- [x] 2.5 移除 `text model` 相关 prompt 逻辑

## 3. watcher.ts 改造

- [x] 3.1 定义 `MEDIA_EXTENSIONS` 常量
- [x] 3.2 添加 `isMediaFile` 函数
- [x] 3.3 在 `handleFileAdded` 中添加媒体文件检查
- [x] 3.4 在 `scanExistingFiles` 中添加媒体文件检查

## 4. config.ts 改造

- [x] 4.1 移除 `txtCategories` 相关 merge 逻辑

## 5. cli.ts 改造

- [x] 5.1 移除 `--ollama-text-model` CLI 选项
- [x] 5.2 移除 CLI merge 中的 textModel 相关逻辑

## 6. 测试验证

- [x] 6.1 编译 TypeScript
- [x] 6.2 测试图片文件正常处理
- [x] 6.3 测试视频文件正常处理
- [x] 6.4 测试文本文件被跳过