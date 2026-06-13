## 1. 依赖安装

- [x] 1.1 安装 `js-yaml` 依赖
- [x] 1.2 安装 `inquirer` 依赖
- [x] 1.3 安装 `@types/js-yaml` 类型定义

## 2. types.ts 改造

- [x] 2.1 移除 `customPrompt` 配置项
- [x] 2.2 移除 `imgCategories` 配置项 (未使用)

## 3. config.ts 改造

- [x] 3.1 改为 YAML 格式读写
- [x] 3.2 实现 `checkConfigExists()` 函数
- [x] 3.3 实现 `promptInit()` 提示函数 (移到cli.ts)
- [x] 3.4 更新 `loadConfig` 支持 YAML
- [x] 3.5 更新 `saveConfig` 支持 YAML
- [x] 3.6 实现 getConfigValue/setConfigValue/listConfig

## 4. classifier.ts 改造

- [x] 4.1 移除 `customPrompt` 使用
- [x] 4.2 更新 PresetType 移除 customPrompt

## 5. cli.ts 改造 - 移除参数

- [x] 5.1 移除 `-i, --input` 参数
- [x] 5.2 移除 `-o, --output` 参数
- [x] 5.3 移除 `--ollama-endpoint` 参数
- [x] 5.4 移除 `--ollama-vision-model` 参数
- [x] 5.5 移除 `--ollama-prompt` 参数
- [x] 5.6 移除 `--ollama-max-concurrency` 参数
- [x] 5.7 移除 `--filename-style` 参数
- [x] 5.8 移除 `--filename-style-prompt` 参数
- [x] 5.9 移除 `-c, --config` 参数

## 6. cli.ts 改造 - 新命令

- [x] 6.1 实现 `init` 命令
- [x] 6.2 实现 `config list` 命令
- [x] 6.3 实现 `config get` 命令
- [x] 6.4 实现 `config set` 命令 (支持嵌套)

## 7. cli.ts 改造 - 无配置提示

- [x] 7.1 start 命令增加配置检查
- [x] 7.2 status 命令增加配置检查
- [x] 7.3 clear 命令增加配置检查
- [x] 7.4 reprocess 命令增加配置检查

## 8. 测试验证

- [x] 8.1 编译 TypeScript
- [x] 8.2 测试 `ai-classify init` 交互流程
- [x] 8.3 测试 `ai-classify config list/get/set`
- [x] 8.4 测试无配置时的提示
- [x] 8.5 测试 YAML 配置读写