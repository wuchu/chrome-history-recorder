## ADDED Requirements

### Requirement: 图片格式预处理
系统 必须 (SHALL) 在发送图片给 Ollama 前进行格式预处理。

#### Scenario: webp 格式转换
- **WHEN** 输入文件为 webp 格式
- **THEN** 系统 必须 (SHALL) 将其转换为 png 格式