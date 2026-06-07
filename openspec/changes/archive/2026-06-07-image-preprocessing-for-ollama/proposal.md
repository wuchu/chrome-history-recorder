## Why

当前 ai-classify 在处理图片时直接将原始格式（如 webp）的 base64 数据发送给 Ollama API，但某些 vision 模型（如 `qwen3-vl:4b`）不支持 webp 格式，导致请求返回 400 错误。

此外，对于视频文件（如 mp4），当前系统无法处理，但用户希望也能通过提取关键帧来获取分类信息。

**测试验证：**
- webp 图片直接发送 → 400 错误 "Failed to load image or audio file"
- 转换为 png 后发送 → 成功识别并返回描述

## What Changes

- 新增图片预处理流程：将 webp 等特殊格式转换为 png/jpg 后再发送给 Ollama
- 新增视频处理流程：从 mp4 视频提取关键帧，将关键帧发送给 Ollama 进行分类
- 保持向后兼容：jpg/png/gif 等标准格式无需转换，直接处理

## Capabilities

### New Capabilities
- `image-preprocessing`: 图片预处理流程，支持格式转换（webp → png/jpg）
- `video-frame-extraction`: 视频关键帧提取，支持从 mp4 提取帧用于分类

### Modified Capabilities
- `ollama-classifier`: 分类器调用前增加预处理步骤