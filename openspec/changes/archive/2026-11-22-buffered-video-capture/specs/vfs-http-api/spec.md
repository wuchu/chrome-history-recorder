## ADDED Requirements

### Requirement: Assembly job endpoints

VFS Service 必须 (SHALL) 提供内部 HTTP 端点，用于在入库前按字节偏移接收并组装缓冲视频。

所有 assembly 端点必须 (SHALL) 仅监听 localhost，并要求建 job 时签发的一次性 token。

#### Scenario: 创建 assembly job
- **WHEN** 客户端发送 `POST /assemblies`，请求体包含 `totalSize`、`mimeType`、`sourceUrl`、`pageUrl` 和 `capturedAt`
- **THEN** 服务必须 (SHALL) 校验 MIME 类型为受支持的 `video/*`
- **AND** 服务必须 (SHALL) 校验 `totalSize` 不超过配置的上传上限
- **AND** 服务必须 (SHALL) 在 `workspace/tmp/assemblies/` 下创建以随机 job id 命名的临时文件
- **AND** 服务必须 (SHALL) 返回 `jobId` 和一次性 `token`

#### Scenario: 创建请求非法
- **WHEN** 创建请求缺少 `totalSize`、MIME 类型不受支持、或 `totalSize` 超过上限
- **THEN** 服务必须 (SHALL) 返回 `400`、`415` 或 `413`
- **AND** 服务不得 (MUST NOT) 保留临时文件

#### Scenario: 按偏移写入 chunk
- **WHEN** 客户端发送 `PUT /assemblies/:jobId/chunks?offset=N`，携带有效 token 和 `Content-Type: application/octet-stream`
- **THEN** 服务必须 (SHALL) 将该请求体写入临时文件的 `N` 偏移处
- **AND** 服务必须 (SHALL) 记录已写入的字节区间
- **AND** 服务必须 (SHALL) 返回 `204 No Content`

#### Scenario: 写入越界
- **WHEN** `offset` 为负、`offset + bodyLength` 超过 `totalSize`，或 body 为空
- **THEN** 服务必须 (SHALL) 拒绝写入并返回 `400` 或 `413`
- **AND** 服务必须 (SHALL) 保持已记录区间不变

#### Scenario: token 或 job 无效
- **WHEN** 请求携带缺失或错误的 token，或 `jobId` 不存在
- **THEN** 服务必须 (SHALL) 返回 `403` 或 `404`
- **AND** 服务不得 (MUST NOT) 写入任何字节

#### Scenario: 完成组装
- **WHEN** 客户端发送 `POST /assemblies/:jobId/complete`，携带有效 token
- **THEN** 服务必须 (SHALL) 校验已记录区间的并集覆盖 `[0, totalSize)`
- **AND** 覆盖完整时，服务必须 (SHALL) 将临时文件以流式方式交给 `saveFileFromStream`
- **AND** 服务必须 (SHALL) 返回包含 `hash`、`duplicate`、`size` 和 `mimeType` 的 JSON
- **AND** 服务必须 (SHALL) 在完成或失败后删除临时文件

#### Scenario: 覆盖不完整时拒绝完成
- **WHEN** 已记录区间存在空洞
- **THEN** 服务必须 (SHALL) 返回 `409 Conflict`
- **AND** 响应必须 (SHALL) 包含缺失字节数
- **AND** 服务不得 (MUST NOT) 创建文件元数据

#### Scenario: 放弃组装
- **WHEN** 客户端发送 `DELETE /assemblies/:jobId`，或会话停止、标签页关闭、页面导航触发放弃
- **THEN** 服务必须 (SHALL) 删除临时文件并释放 job
- **AND** 服务必须 (SHALL) 返回 `204 No Content`

#### Scenario: 不活动 job 过期
- **WHEN** 一个 assembly job 超过配置的不活动超时时间没有写入
- **THEN** 服务必须 (SHALL) 自动放弃该 job 并删除临时文件

#### Scenario: 并发 job 上限
- **WHEN** 活跃 assembly job 数量达到配置上限
- **THEN** 服务必须 (SHALL) 拒绝创建新 job
- **AND** 错误响应必须 (SHALL) 标明资源限制原因

#### Scenario: 启动时清理残留
- **WHEN** VFS Service 启动
- **THEN** 服务必须 (SHALL) 删除超过保留时限的 assembly 临时文件

#### Scenario: Web 页面不可直接调用
- **WHEN** 一个普通网页尝试调用 assembly 端点
- **THEN** 服务不得 (MUST NOT) 为该来源授予 CORS 访问
- **AND** 缺少一次性 token 的请求必须 (SHALL) 被拒绝
