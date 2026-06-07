# AI Classify

AI-powered file classification CLI tool using Ollama.

## Overview

`ai-classify` monitors a directory for new files, analyzes their content using local Ollama AI models, and automatically organizes them into a structured output directory with intelligent naming.

## Features

- **Directory Monitoring**: Watch input directory for file changes
- **AI Classification**: Use Ollama vision/text models to analyze content
- **Smart Organization**: Copy and rename files based on AI suggestions
- **Non-invasive**: Original files remain unchanged
- **Deduplication**: Hash-based index prevents duplicate processing
- **Task Queue**: Persistent queue with priority support
- **Resume**: Restart continues from last task

## Installation

```bash
# In the project directory
pnpm install

# Build the CLI
pnpm --filter ai-classify build
```

## Usage

### Quick Start (Pure CLI Parameters)

No configuration file needed - just run with parameters:

```bash
ai-classify start -i ./downloads -o ./organized --ollama-endpoint http://localhost:11434
```

### Initialize Configuration

```bash
ai-classify config -i ./downloads -o ./organized --ollama-endpoint http://localhost:11434
```

This creates `.ai-classify.json` in your project directory.

### Start Watching

```bash
ai-classify start
```

The tool will:
1. Scan existing files in input directory
2. Start watching for new files
3. Process files using Ollama AI
4. Organize to output directory

### Custom Classification Prompt

Use a custom prompt for classification:

```bash
ai-classify start --ollama-prompt "按文件类型分类：文档、图片、代码"
```

### Adjust Concurrency

Control how many files are processed simultaneously:

```bash
ai-classify start --ollama-max-concurrency 5
```

### Use Custom Config File

```bash
ai-classify start -c ./my-config.json
```

### Check Status

```bash
ai-classify status
```

Shows queue statistics and processed file count.

### Clear Queue

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

### Configuration Priority

Settings are loaded in this order (later overrides earlier):

1. **Default values** (built-in defaults)
2. **Configuration file** (`.ai-classify.json` or custom path via `-c`)
3. **CLI parameters** (highest priority)

### CLI Options

| Option | Description |
|--------|-------------|
| `-c, --config <file>` | Custom config file path |
| `-i, --input <dir>` | Input directory |
| `-o, --output <dir>` | Output directory |
| `--ollama-endpoint <url>` | Ollama API URL |
| `--ollama-vision-model <model>` | Vision model (default: llava) |
| `--ollama-text-model <model>` | Text model (default: llama3) |
| `--ollama-prompt <text>` | Custom classification prompt |
| `--ollama-max-concurrency <number>` | Max concurrent requests (1-20, default: 3) |

### Config File

`.ai-classify.json`:

```json
{
  "input": "./downloads",
  "output": "./organized",
  "ollamaEndpoint": "http://localhost:11434",
  "visionModel": "llava",
  "textModel": "llama3",
  "customPrompt": "按文件类型分类：文档、图片、代码",
  "patterns": ["**/*.{jpg,jpeg,png,gif,webp,bmp,pdf,txt,md}"],
  "ignorePatterns": ["**/node_modules/**", "**/.git/**"],
  "organizeBy": "category",
  "maxFileSize": 52428800,
  "concurrency": 3
}
```

| Option | Description |
|--------|-------------|
| `input` | Directory to watch for new files |
| `output` | Directory for organized files |
| `ollamaEndpoint` | Ollama API URL |
| `visionModel` | Model for image analysis (default: llava) |
| `textModel` | Model for text analysis (default: llama3) |
| `customPrompt` | Custom classification prompt (optional) |
| `patterns` | Glob patterns for file types |
| `ignorePatterns` | Patterns to ignore |
| `organizeBy` | 'category' or 'date' |
| `maxFileSize` | Max file size in bytes (default: 50MB) |
| `concurrency` | Concurrent processing limit (1-20) |

### Concurrency Control

The `--ollama-max-concurrency` option controls how many files are processed simultaneously:

- **Low concurrency (1-2)**: Good for resource-constrained machines or debugging
- **Default (3)**: Balanced for most use cases
- **High concurrency (5-10)**: For powerful machines with many files
- **Maximum (up to 20)**: Only for high-end servers with abundant resources

Example usage:

```bash
# Debug mode - process one file at a time
ai-classify start --ollama-max-concurrency 1

# High throughput mode
ai-classify start --ollama-max-concurrency 10
```

## Output Structure

### By Category

```
organized/
├── photo/
│   ├── sunset_beach.jpg
│   └── mountain_view.jpg
├── screenshot/
│   ├── error_message.png
│   └── dashboard.png
├── document/
│   ├── report_2024.pdf
│   └── meeting_notes.txt
```

### By Date

```
organized/
├── 2024-01-15/
│   ├── photo_sunset.jpg
│   ├── screenshot_error.png
├── 2024-01-16/
│   ├── document_report.pdf
```

## Data Files

| File | Location | Purpose |
|------|----------|---------|
| `index.json` | Output directory | Hash index of processed files |
| `queue.json` | Output directory | Persistent task queue |
| `.ai-classify.json` | Project root | Configuration |

## Requirements

- Node.js 18+
- Ollama running locally with vision and text models
- Supported models: llava (images), llama3 (text)

## License

MIT