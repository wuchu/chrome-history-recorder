## Why

小模型 (如 Gemma 3 4B) 输出 JSON 格式不稳定，导致解析失败、重命名出错。需要简化 Prompt 并增加多重解析 fallback，提高可靠性。

## What Changes

- 简化 Prompt：从复杂 JSON 格式改为简单的 `CATEGORY | FILENAME` 分隔符格式
- 多重解析 fallback：管道分隔 → 空格分隔 → JSON → 原文件名
- 文件名清理：确保英文、安全字符、长度限制
- 保留 language 配置：中文 Prompt 也能输出英文文件名

## Capabilities

### New Capabilities

无新增能力。

### Modified Capabilities

- `ollama-classifier`: Prompt 格式简化，解析逻辑增强

## Impact

| 文件 | 变更 |
|------|------|
| `classifier.ts` | 新 Prompt + 新解析逻辑 + 文件名清理函数 |