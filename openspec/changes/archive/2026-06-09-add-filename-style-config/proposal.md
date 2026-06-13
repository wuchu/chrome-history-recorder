## Why

当前文件名命名风格单一，用户无法自定义命名的语气/风格。同时：
- 中文用户期望中文文件名，而非强制英文
- 不同场景需要不同的命名风格（活泼、专业、艺术等）
- 文件名长度需要控制，避免过长

## What Changes

- 新增 `filenameStyle` 配置项：预设风格（auto, fun, sexy, artistic, poetic, minimal, professional, narrative）
- 新增 `filenameStylePrompt` 配置项：自定义风格提示词
- 中文输出中文文件名，英文输出英文文件名
- Prompt 中加入长度约束（中文15-25字，英文3-8词）
- sanitizeFilename 放宽规则：允许中文字符，只移除文件系统禁用字符

## Capabilities

### New Capabilities

- `filename-styling`: 用户可配置文件命名风格

### Modified Capabilities

- `ollama-classifier`: Prompt 根据语言和风格动态生成，输出对应语言的文件名

## Impact

| 文件 | 变更 |
|------|------|
| `types.ts` | 新增 `filenameStyle`, `filenameStylePrompt` 配置项 |
| `classifier.ts` | 重写 `buildPrompt` 支持风格+长度约束，修改 `sanitizeFilename` 放宽规则 |
| `cli.ts` | 新增 `--filename-style` CLI 选项 |