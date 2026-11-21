## MODIFIED Requirements

### Requirement: 文件捕获事件
app 事件总线必须 (SHALL) 在文件捕获时推送实时事件。

#### Scenario: 推送文件捕获事件
- **WHEN** 新文件成功保存（无论来自 CDP 网络捕获还是一次性捕获）
- **THEN** 系统必须 (SHALL) 推送 `file:captured` 事件
- **AND** 事件数据必须 (SHALL) 包含：
  - `hash`: 文件哈希
  - `mimeType`: MIME 类型
  - `size`: 文件大小（字节）
  - `capturedAt`: 捕获时间（ISO 8601）
  - `sourceUrl`: 来源 URL（可为 null）
  - `sourceDomain`: 来源域名（可为 null）
  - `duplicate`: 是否为重复保存（该事件只在非重复入库时推送时为 false）

#### Scenario: 事件格式
- **WHEN** 推送任何事件
- **THEN** 系统必须 (SHALL) 使用 JSON 格式
- **AND** 格式必须 (SHALL) 为：
  ```json
  {
    "event": "<event-name>",
    "data": { ... },
    "timestamp": "<ISO-8601>"
  }
  ```
