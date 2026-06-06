## Context

用户需要管理大量下载的文件（图片、文档、视频等），希望借助 AI 自动分类和重命名。工具需要：
- 监控指定目录的新增文件
- 调用本地 Ollama 服务进行内容识别
- 复制文件到目标目录并智能重命名
- 支持断点续传

**约束**:
- 不修改源文件（只复制）
- 使用本地 Ollama（不上传到云端）
- 支持 macOS/Linux/Windows

## Goals / Non-Goals

**Goals:**
- CLI 命令行工具，易于使用
- 实时监控目录变更
- AI 智能分类和命名
- 断点续传能力
- 可配置的分类规则

**Non-Goals:**
- 不支持云端 AI 服务
- 不修改或删除源文件
- 不提供 GUI 界面
- 不支持实时流媒体处理

## Decisions

### 1. 文件监控方案：chokidar vs node:fs.watch

**决定**: 使用 chokidar

**理由**:
- chokidar 更稳定，跨平台兼容性好
- 支持递归目录监控
- 提供更好的事件过滤能力

**备选方案**: node:fs.watch - 原生 API，但跨平台行为不一致

### 2. AI 接口方案：Ollama API vs LangChain

**决定**: 直接调用 Ollama HTTP API

**理由**:
- 简单直接，无额外依赖
- Ollama 本地运行，响应快
- 可以使用 `/api/chat` 或 `/api/embeddings` 接口

**备选方案**: LangChain - 功能更丰富但依赖重

### 3. 文件 Hash 方案：MD5 vs SHA-256

**决定**: 使用 SHA-256

**理由**:
- 更安全的 hash 算法
- 碰撞概率更低
- Node.js crypto 模块原生支持

### 4. 数据持久化方案：JSON 文件 vs SQLite

**决定**: 使用 JSON 文件

**理由**:
- 简单易用，无需额外依赖
- 人类可读，便于调试
- 数据量预计不大

**备选方案**: SQLite - 更适合大量数据，但增加复杂度

### 5. 任务队列方案：内存队列 vs 持久化队列

**决定**: 持久化队列 + 内存缓存

**理由**:
- 队列数据保存到文件，支持断点续传
- 启动时加载队列，运行时内存操作
- 定期持久化，避免数据丢失

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| Ollama 服务不可用 | 提供健康检查，错误时将文件放入队列等待重试 |
| 大文件处理耗时 | 设置文件大小上限，大文件标记跳过 |
| AI 分类不准确 | 提供人工干预选项，允许用户调整分类 |
| 监控目录文件过多 | 使用 glob 过滤，只监控特定类型文件 |
| 队列数据损坏 | 使用 JSON 校验，提供修复命令 |

## Architecture

```
ai-classify/
├── src/
│   ├── cli.ts           # CLI 入口
│   ├── index.ts         # 主模块
│   ├── watcher.ts       # 目录监控
│   ├── classifier.ts    # AI 分类器
│   ├── organizer.ts     # 文件整理
│   ├── queue.ts         # 任务队列
│   ├── hashIndex.ts     # Hash 索引
│   └── config.ts        # 配置管理
│   └── types.ts         # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## CLI Commands

```bash
# 启动分类任务
ai-classify start --input ./downloads --output ./organized

# 查看队列状态
ai-classify status

# 清空队列
ai-classify clear

# 重新处理所有文件
ai-classify reprocess --input ./downloads
```

## Data Structures

**任务队列 (queue.json)**:
```json
{
  "pending": [
    { "path": "/path/to/file", "hash": "abc123", "addedAt": "2024-01-01" }
  ],
  "processing": [],
  "failed": []
}
```

**Hash 索引 (index.json)**:
```json
{
  "processed": {
    "abc123": { "outputPath": "/output/images/photo_2024.jpg", "processedAt": "2024-01-01" }
  }
}
```

## Open Questions

- 默认支持的文件类型列表？
- 分类目录结构规则（按类型/按日期）？
- Ollama 默认模型选择（llava vs llama3）？