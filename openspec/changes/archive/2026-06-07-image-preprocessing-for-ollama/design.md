## Context

Ollama vision 模型（如 qwen3-vl）不支持 webp 格式，需要预处理转换。

## Goals / Non-Goals

**Goals:**
- webp → png 自动转换
- mp4 关键帧提取
- 临时文件自动清理

**Non-Goals:**
- 不支持其他视频格式

## Decisions

- 使用 sharp 库转换图片
- 使用 ffmpeg 提取视频帧
- 处理完成后清理临时文件

## Risks

| 风险 | 缓解 |
|------|------|
| ffmpeg 未安装 | 检查可用性并提示 |