## Why

用户经常需要整理和分类大量文件（如下载的图片、文档、视频等），手动分类费时费力且容易出错。通过 AI 自动识别文件内容并进行智能分类命名，可以大幅提升文件管理效率。同时需要支持断点续传，避免重复处理已完成的文件。

## What Changes

- **新 pnpm package**: `ai-classify` - 一个独立的 CLI 命令行工具包
- **目录监控**: 使用 chokidar 监控输入目录的文件变更
- **AI 分类**: 调用本地 Ollama 大模型接口识别文件内容，生成分类和命名建议
- **非侵入式处理**: 只复制文件到目标目录，不修改源文件
- **智能重命名**: 根据 AI 分析结果重命名文件（添加分类前缀或描述性名称）
- **Hash 索引**: 存储已处理文件的 hash，避免重复处理
- **任务队列**: 维护待处理文件队列，支持优先级排序
- **断点续传**: 重启后自动恢复上次未完成的任务

## Capabilities

### New Capabilities

- `directory-watcher`: 监控输入目录变更，检测新增文件
- `ollama-classifier`: 调用 Ollama API 分析文件内容并生成分类建议
- `file-organizer`: 复制、重命名并整理文件到目标目录结构
- `task-queue`: 任务队列管理，支持持久化和断点续传
- `hash-index`: 已处理文件的 hash 索引，防止重复处理

### Modified Capabilities

<!-- 无现有能力被修改 -->

## Impact

- **新代码**:
  - `ai-classify/` - 新的 pnpm package 目录
  - CLI 入口 (`src/cli.ts`)
  - 核心模块：watcher、classifier、organizer、queue、index
- **依赖**:
  - `chokidar` - 文件监控
  - `ollama-ai` 或 HTTP 客户端调用本地 Ollama API
  - `commander` - CLI 命令解析
  - `fs-extra` - 文件操作增强
- **配置文件**:
  - `.ai-classify.json` - 项目配置（输入目录、输出目录、Ollama 端点等）
- **数据文件**:
  - `.ai-classify/index.json` - hash 索引
  - `.ai-classify/queue.json` - 待处理队列