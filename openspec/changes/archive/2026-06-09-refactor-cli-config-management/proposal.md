## Why

当前 CLI 参数过多，用户每次运行都要指定参数，体验不佳。配置文件使用 JSON 格式不够友好。用户希望通过交互式初始化和配置管理命令来简化使用。

## What Changes

- 移除所有 CLI 参数 (如 `-i`, `-o`, `--ollama-endpoint` 等)
- 移除 `customPrompt` 配置项 (功能与 `filenameStylePrompt` 重叠)
- 配置文件改为 YAML 格式 (`.ai-classify.yaml`)
- 新增 `ai-classify init` 命令 - 交互式初始化配置
- 新增 `ai-classify config list/get/set` 命令 - 配置管理
- 无配置文件时，命令提示用户先运行 `init`

## Capabilities

### New Capabilities

- `interactive-init`: 交互式配置初始化
- `config-management`: 配置查看和修改

### Modified Capabilities

- `cli-entry-point`: 简化命令行参数，增加新命令
- `configuration`: YAML 格式，增加验证和提示

## Impact

| 文件 | 变更 |
|------|------|
| `cli.ts` | 移除参数，增加 init/config 命令 |
| `config.ts` | YAML 格式，增加验证逻辑 |
| `types.ts` | 移除 customPrompt |
| `classifier.ts` | 移除 customPrompt 使用 |
| `package.json` | 增加 yaml 解析库 (js-yaml) 和交互库 (inquirer) |