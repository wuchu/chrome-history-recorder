## Context

当前 CLI 有大量参数，配置文件是 JSON 格式。用户希望简化使用流程，通过交互式初始化和配置管理来替代命令行参数。

## Goals / Non-Goals

**Goals:**
- 交互式 init 命令，引导用户完成必要配置
- config 子命令支持 list/get/set
- YAML 格式配置文件
- 无配置时友好提示
- 移除冗余参数

**Non-Goals:**
- 不改变分类/命名核心逻辑
- 不支持远程配置管理

## Decisions

### init 命令交互流程

```typescript
// Step 1: 输入目录 - 列出当前目录文件夹
? 选择输入目录:
  ❯ ./input (如果存在)
    ./photos (如果存在)
    手动输入

// Step 2: 输出目录 - 手动输入
? 输出目录: ./output

// Step 3: Ollama 地址 - 手动输入有默认
? Ollama 服务地址: http://localhost:11434

// Step 4: 视觉模型 - 从 API 获取列表或手动输入
? 选择视觉模型:
  ❯ gemma4:e4b (从 /api/tags 获取)
    llava
    手动输入
    稍后设置

// Step 5: 语言 - 选择
? 输出语言: zh-CN / en

// Step 6: 文件命名风格 - 选择
? 文件命名风格: auto / fun / sexy / ...

// Step 7: 组织方式 - 选择
? 文件组织方式: category / date
```

### 配置文件格式

```yaml
# .ai-classify.yaml

# 必选
input: ./input
output: ./output
ollamaEndpoint: http://localhost:11434
visionModel: gemma4:e4b

# 可选
language: zh-CN
filenameStyle: auto
organizeBy: category
concurrency: 3

# 高级
patterns:
  - "**/*.{jpg,jpeg,png,gif,webp,bmp,mp4}"
ignorePatterns:
  - "**/node_modules/**"
  - "**/.git/**"
maxFileSize: 52428800
```

### config 子命令

```bash
ai-classify config list
ai-classify config get <key>
ai-classify config set <key> <value>

# 支持嵌套
ai-classify config set patterns[0] "*.jpg"
```

### 无配置提示

```bash
$ ai-classify start

✗ 未找到配置文件 .ai-classify.yaml

请先运行初始化命令:
  ai-classify init
```

### 库选择

- YAML: `js-yaml` (主流，轻量)
- 交互式: `inquirer` (最主流，功能全)

## Risks / Trade-offs

**风险**: 用户可能不习惯交互式方式
→ **缓解**: config set 命令支持脚本化配置

**风险**: YAML 文件手动编辑可能格式错误
→ **缓解**: loadConfig 时验证格式，提示错误位置