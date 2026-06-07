## Context

当前 ai-classify CLI 使用 `commander` 库，配置加载逻辑：

```typescript
// 当前流程
const baseConfig = await loadConfig(projectDir); // 固定从 cwd/.ai-classify.json
const config = mergeWithCliArgs(baseConfig, args); // CLI 参数覆盖
```

**问题**：
- `loadConfig` 使用固定的 `CONFIG_FILE = '.ai-classify.json'`
- 无法指定其他配置文件路径
- 无法不依赖配置文件直接启动

## Goals / Non-Goals

**Goals:**
- 支持 `-c, --config <file>` 指定配置文件
- 支持纯参数启动（无配置文件）
- CLI 参数优先级最高
- 保持向后兼容（默认仍查找 `.ai-classify.json`）

**Non-Goals:**
- 不修改核心分类逻辑
- 不添加环境变量支持（可选）
- 不实现配置热更新

## Decisions

### 1. 配置优先级

**顺序**（后者覆盖前者）：
1. 默认值（DEFAULT_CONFIG）
2. 配置文件（如指定或默认路径）
3. CLI 参数

**实现**：
```typescript
// 新流程
const configFile = options.config || '.ai-classify.json';
const fileConfig = await loadConfig(configFile); // 支持指定路径
const config = mergeWithCliArgs(fileConfig, options);
```

### 2. 全局选项 vs 子命令选项

**方案**：使用 commander 的全局选项

```typescript
program
  .option('-c, --config <file>', 'Config file path')
  .option('-i, --input <dir>', 'Input directory')
  .option('-o, --output <dir>', 'Output directory')
  // Ollama 相关选项（统一前缀）
  .option('--ollama-endpoint <url>', 'Ollama API endpoint')
  .option('--ollama-vision-model <model>', 'Ollama vision model')
  .option('--ollama-text-model <model>', 'Ollama text model')
  .option('--ollama-prompt <text>', 'Custom classification prompt')
  .option('--ollama-max-concurrency <number>', 'Max concurrent requests to Ollama', parseInt)
```

**理由**：
- 全局选项可在任意子命令使用
- 更符合 CLI 工具惯例
- `--ollama-xxx` 前缀清晰表明这些是 Ollama 相关配置
- 代码更简洁

### 3. 配置文件路径处理

**支持**：
- 相对路径：`-c ./my-config.json`（相对于 cwd）
- 绝对路径：`-c /path/to/config.json`
- 默认路径：无 `-c` 时查找 `.ai-classify.json`

### 4. 无配置文件模式

当 `-c` 未指定且 `.ai-classify.json` 不存在时：
- 使用 DEFAULT_CONFIG
- CLI 参数覆盖默认值
- 可完全通过参数启动

### 5. 自定义提示词设计

**提示词模板变量**：
- `{type}` - 文件类型 (image/text)
- 系统自动注入文件内容或 base64 图片

**提示词使用方式**：
```typescript
// Config 新增字段
interface Config {
  // ...existing fields
  customPrompt?: string;  // 自定义提示词
}

// classifier.ts 中使用
const prompt = config.customPrompt || getDefaultPrompt(fileType);
```

**默认提示词**（保持现有行为）：
- 图片：分析图片并提供分类、建议名称、标签、置信度
- 文本：分析文本内容并提供分类、建议名称、标签、置信度

### 6. 并发控制设计

**配置字段**：
```typescript
interface Config {
  // ...existing fields
  concurrency: number;  // 已存在，默认 3
}
```

**CLI 选项**：
```bash
--ollama-max-concurrency <number>  # 覆盖配置文件中的 concurrency
```

**使用场景**：
- 高性能服务器：增大并发以加快处理速度
- 低配置机器：减小并发避免资源耗尽
- 调试模式：设置 `--ollama-max-concurrency 1` 便于排查问题

### 7. 命名约定

**Ollama 相关参数统一前缀**：
- 所有与 Ollama 服务交互相关的参数使用 `--ollama-xxx` 前缀
- 好处：
  - 参数分组清晰，一眼看出哪些是 Ollama 配置
  - 避免与其他服务的参数混淆（未来可能支持其他 AI 后端）
  - 自动补全友好：输入 `--ollama-` 可列出所有相关选项

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 全局选项与子命令选项冲突 | 使用 `program.opts()` 获取全局选项 |
| 配置文件不存在时的行为 | 明确文档说明，使用默认值 |
| 相对路径解析错误 | 使用 `path.resolve()` 确保 absolute path |