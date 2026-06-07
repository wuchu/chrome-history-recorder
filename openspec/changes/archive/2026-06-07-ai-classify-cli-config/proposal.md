## Why

当前 ai-classify CLI 的配置方案不够灵活：

1. **配置文件路径固定**：只能使用当前目录下的 `.ai-classify.json`，无法指定自定义配置文件路径
2. **参数传递不够直观**：需要先进入项目目录或使用子命令选项，无法直接通过命令行参数快速启动
3. **缺少全局配置支持**：无法在多个项目间共享同一套配置
4. **提示词固定**：分类提示词硬编码在代码中，无法自定义分类规则

使用场景：
- 快速测试：`ai-classify start --input ./test --output ./out --ollama-endpoint http://localhost:11434`
- 使用自定义配置：`ai-classify start -c ./my-config.json`
- 自定义分类规则：`ai-classify start --ollama-prompt "按文件类型分类：文档、图片、代码"`
- 调整并发数：`ai-classify start --ollama-max-concurrency 5`
- CI/CD 环境：通过纯参数启动，无需配置文件

## What Changes

- 新增 `-c, --config <file>` 全局选项，指定配置文件路径
- 新增全局选项直接传递核心参数：
  - `-i, --input <dir>` - 输入目录
  - `-o, --output <dir>` - 输出目录
- 新增 Ollama 相关注项（统一 `--ollama-xxx` 前缀）：
  - `--ollama-endpoint <url>` - Ollama API 地址
  - `--ollama-vision-model <model>` - 视觉模型
  - `--ollama-text-model <model>` - 文本模型
  - `--ollama-prompt <text>` - 自定义分类提示词
  - `--ollama-max-concurrency <number>` - 最大并发请求数
- 优化配置加载顺序：CLI 参数 > 配置文件 > 默认值
- 支持无配置文件直接启动（纯参数模式）
- 分类器使用自定义提示词（如提供）

## Capabilities

### New Capabilities
- `cli-flexible-config`: CLI 配置灵活化，支持配置文件路径、纯参数模式和自定义提示词

### Modified Capabilities
- 无（不改变功能需求，仅改变 CLI 交互方式和分类提示词）

## Impact

- 修改 `packages/ai-classify/src/cli.ts` - 添加全局选项
- 修改 `packages/ai-classify/src/config.ts` - 支持配置优先级和提示词配置
- 修改 `packages/ai-classify/src/types.ts` - 添加 `customPrompt` 字段
- 修改 `packages/ai-classify/src/classifier.ts` - 使用自定义提示词和并发配置
- 更新 `packages/ai-classify/README.md`