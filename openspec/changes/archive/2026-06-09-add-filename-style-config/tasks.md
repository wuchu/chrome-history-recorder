## 1. types.ts 改造

- [x] 1.1 新增 `FilenameStyle` 类型定义
- [x] 1.2 新增 `filenameStyle` 配置项
- [x] 1.3 新增 `filenameStylePrompt` 配置项

## 2. classifier.ts 改造

- [x] 2.1 定义风格提示词映射 `STYLE_PROMPTS`
- [x] 2.2 重写 `buildPrompt` 支持风格参数
- [x] 2.3 中文 Prompt：文件名中文 + 15-25字约束
- [x] 2.4 英文 Prompt：文件名英文 + 3-8词约束
- [x] 2.5 改造 `sanitizeFilename`：放宽规则，允许中文
- [x] 2.6 更新 PresetType 类型

## 3. cli.ts 改造

- [x] 3.1 新增 `--filename-style` CLI 选项
- [x] 3.2 更新 mergeWithCliArgs 支持新配置

## 4. config.ts 改造

- [x] 4.1 更新 mergeWithCliArgs 支持新配置项

## 5. 测试验证

- [x] 5.1 编译 TypeScript
- [x] 5.2 测试中文文件名输出
- [x] 5.3 测试不同风格效果
- [x] 5.4 测试自定义风格提示词