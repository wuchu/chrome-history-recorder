# AI Classify

AI-powered file classification CLI tool using Ollama.

## Overview

`ai-classify` monitors a directory for new files, analyzes their content using local Ollama AI models, and automatically organizes them into a structured output directory with intelligent naming.

## Features

- **Directory Monitoring**: Watch input directory for file changes
- **AI Classification**: Use Ollama vision models to analyze image/video content
- **Smart Organization**: Copy and rename files based on AI suggestions
- **Non-invasive**: Original files remain unchanged
- **Deduplication**: Hash-based index prevents duplicate processing
- **Task Queue**: Persistent event log with crash recovery support
- **Resume**: Restart continues from last state
- **Filename Styles**: Multiple naming styles (auto, fun, poetic, etc.)
- **Internationalization**: Chinese and English output support

## Installation

```bash
# In the project directory
pnpm install

# Build the CLI
pnpm --filter ai-classify build
```

## Usage

### Initialize Configuration

Run interactive configuration:

```bash
ai-classify init
```

This will prompt you for:

- Input directory
- Output directory
- Ollama endpoint URL
- Vision model selection
- Language preference
- Filename style
- Organization mode (by category or date)

Configuration is saved to `.ai-classify.yaml` in your project directory.

### Start Watching

```bash
ai-classify start
```

The tool will:

1. Scan existing files in input directory
2. Start watching for new files
3. Process files using Ollama AI
4. Organize to output directory with intelligent naming

### Check Status

```bash
ai-classify status
```

Shows queue statistics and processed file count.

### Manage Configuration

```bash
# List all config values
ai-classify config list

# Get specific config value
ai-classify config get visionModel

# Set config value
ai-classify config set concurrency 5
```

### Clear Queue and Index

```bash
ai-classify clear
```

Clears the queue and hash index.

### Reprocess All Files

```bash
ai-classify reprocess
```

Clears index and re-processes all files in input directory.

## Configuration

### Configuration File

`.ai-classify.yaml`:

```yaml
input: ./downloads
output: ./organized
ollamaEndpoint: http://localhost:11434
visionModel: llava
language: zh-CN
filenameStyle: auto
organizeBy: category
patterns:
  - '**/*.{jpg,jpeg,png,gif,webp,bmp,mp4}'
ignorePatterns:
  - '**/node_modules/**'
  - '**/.git/**'
maxFileSize: 52428800 # 50MB
concurrency: 3
```

| Option                | Description                       | Default                  |
| --------------------- | --------------------------------- | ------------------------ |
| `input`               | Directory to watch for new files  | `./input`                |
| `output`              | Directory for organized files     | `./output`               |
| `ollamaEndpoint`      | Ollama API URL                    | `http://localhost:11434` |
| `visionModel`         | Model for image/video analysis    | `llava`                  |
| `language`            | Output language (`zh-CN` or `en`) | `zh-CN`                  |
| `filenameStyle`       | Filename naming style             | `auto`                   |
| `filenameStylePrompt` | Custom filename style prompt      | (optional)               |
| `patterns`            | Glob patterns for file types      | images/videos            |
| `ignorePatterns`      | Patterns to ignore                | node_modules, .git       |
| `organizeBy`          | `category` or `date`              | `category`               |
| `maxFileSize`         | Max file size in bytes            | 50MB                     |
| `concurrency`         | Concurrent processing limit       | 3                        |

### Filename Styles

| Style          | Description                              |
| -------------- | ---------------------------------------- |
| `auto`         | Automatically choose based on content    |
| `fun`          | Playful and fun tone                     |
| `sexy`         | Elegant and charming tone                |
| `artistic`     | Artistic tone like describing a painting |
| `poetic`       | Poetic tone with mood and emotion        |
| `minimal`      | Minimal, only core information           |
| `professional` | Professional and concise, objective      |
| `narrative`    | Narrative tone, describe the scene       |

### Concurrency Control

The `concurrency` option controls how many files are processed simultaneously:

- **Low concurrency (1-2)**: Good for resource-constrained machines or debugging
- **Default (3)**: Balanced for most use cases
- **High concurrency (5-10)**: For powerful machines with many files
- **Maximum (up to 20)**: Only for high-end servers

## Output Structure

### By Category

```
organized/
├── cat/
│   ├── 慵懒的黑白猫咪在窗台晒太阳.jpg
│   └── 可爱的小橘猫玩耍.jpg
├── photo/
│   ├── 夕阳下的海滩.jpg
│   └── 山间云雾.jpg
├── screenshot/
│   ├── 错误提示框.png
│   └── 仪表盘界面.png
```

### By Date

```
organized/
├── 2024-01-15/
│   ├── 照片_夕阳.jpg
│   ├── 截图_错误.png
├── 2024-01-16/
│   ├── 文档_报告.pdf
```

## Data Files

| File                      | Location     | Purpose                   |
| ------------------------- | ------------ | ------------------------- |
| `.ai-classify.yaml`       | Project root | Configuration             |
| `.ai-classify-events.log` | Project root | Event log for queue state |
| `.ai-classify-index.json` | (deprecated) | Migrated to event log     |

## Requirements

- Node.js 18+
- Ollama running locally with vision model
- Recommended models: `llava`, `moondream`, or other vision models

## License

MIT
