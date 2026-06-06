## ADDED Requirements

### Requirement: 图片存储 API
代理服务必须 (SHALL) 提供用于存储和检索图片的 HTTP API。

#### Scenario: 接收图片数据
- **WHEN** 在 `/save-image` 接收到 POST 请求
- **THEN** 服务必须 (SHALL) 接收包含 `url`、`mimeType`、`data` 字段的 JSON 数据
- **AND** 服务必须 (SHALL) 配置足够大的 body 解析限制（如 50MB）以处理大尺寸图片

#### Scenario: 解码 base64 数据
- **WHEN** 接收到的 `data` 字段可能包含 data URL 格式或纯 base64
- **THEN** 服务必须 (SHALL) 正确处理两种格式：
  - 如果包含 `,` 分隔符，提取逗号后的 base64 部分
  - 否则直接使用原始数据作为 base64

#### Scenario: 转换为二进制数据
- **WHEN** base64 数据提取完成
- **THEN** 服务必须 (SHALL) 使用 `Buffer.from(base64, 'base64')` 转换为二进制缓冲区

#### Scenario: 生成唯一文件名
- **WHEN** 需要保存图片文件
- **THEN** 服务必须 (SHALL) 生成包含时间戳和原始 URL 文件名的文件名
- **AND** 文件名格式必须 (SHALL) 包含扩展名（从 MIME 类型或 URL 提取）
- **AND** 文件名格式应该 (SHOULD) 为：`<timestamp>_<basename>.<ext>`

#### Scenario: 从 MIME 类型提取扩展名
- **WHEN** MIME 类型为 `image/jpeg`、`image/png` 等
- **THEN** 服务必须 (SHALL) 根据标准 MIME 类型映射提取扩展名

**标准 MIME 类型到扩展名映射表**:
| MIME 类型 | 标准扩展名 | 说明 |
|-----------|-----------|------|
| `image/jpeg` | `.jpg` | JPEG/JPG 图片（注意：使用 jpg 而非 jpeg） |
| `image/png` | `.png` | PNG 图片 |
| `image/gif` | `.gif` | GIF 动画图片 |
| `image/webp` | `.webp` | WebP 现代格式 |
| `image/bmp` | `.bmp` | BMP 位图 |
| `image/tiff` | `.tiff` 或 `.tif` | TIFF 专业格式 |
| `image/svg+xml` | `.svg` | SVG 矢量图形 |
| `image/x-icon` | `.ico` | ICO 图标 |
| `image/vnd.microsoft.icon` | `.ico` | ICO 图标（Microsoft 标准） |

**扩展名处理优先级**:
1. 优先从 MIME 类型提取（最可靠）
2. 备选：从 URL 文件名提取扩展名
3. 兜底：使用 `.bin` 作为通用扩展名

#### Scenario: 如不存在则创建日期目录
- **WHEN** 为新日期保存图片
- **THEN** 服务必须 (SHALL) 自动创建日期子目录

#### Scenario: 返回保存的图片哈希
- **WHEN** 图片成功保存
- **THEN** 服务必须 (SHALL) 返回内容哈希作为标识符

#### Scenario: 防止重复存储
- **WHEN** 具有相同内容哈希的图片已存在
- **THEN** 服务必须 (SHALL) 跳过写入并返回现有哈希

### Requirement: 图片检索 API
代理服务必须 (SHALL) 提供端点用于列出和检索存储的图片。

#### Scenario: 列出所有存储的图片
- **WHEN** 在 `/images` 接收到 GET 请求
- **THEN** 服务必须 (SHALL) 返回所有存储图片元数据（哈希、大小、时间戳、日期）的 JSON 数组

#### Scenario: 按日期列出图片
- **WHEN** 在 `/images?date=YYYY-MM-DD` 接收到 GET 请求
- **THEN** 服务必须 (SHALL) 仅返回来自该特定日期目录的图片

#### Scenario: 检索特定图片
- **WHEN** 在 `/images/:hash` 接收到 GET 请求
- **THEN** 服务必须 (SHALL) 返回图片文件并附带正确的 Content-Type 头

#### Scenario: 处理缺失图片
- **WHEN** 请求的图片哈希不存在
- **THEN** 服务必须 (SHALL) 返回 404 Not Found

### Requirement: 图片删除 API
代理服务必须 (SHALL) 允许删除存储的图片。

#### Scenario: 通过哈希删除图片
- **WHEN** 在 `/images/:hash` 接收到 DELETE 请求
- **THEN** 服务必须 (SHALL) 从磁盘移除图片文件

#### Scenario: 处理不存在图片的删除
- **WHEN** 请求删除不存在的哈希
- **THEN** 服务必须 (SHALL) 返回 404 Not Found

### Requirement: 健康检查端点
代理服务必须 (SHALL) 提供健康检查端点，用于监控服务运行状态。

#### Scenario: 检查服务可用性
- **WHEN** 在 `/health` 接收到 GET 请求
- **THEN** 服务必须 (SHALL) 返回 200 OK 和状态 JSON
- **AND** 状态 JSON 必须 (SHALL) 包含 `status` 字段（值为 `"ok"`）
- **AND** 状态 JSON 可以 (MAY) 包含额外信息：
  - `uptime`: 服务运行时长（秒）
  - `storagePath`: 当前存储路径
  - `totalImages`: 已保存图片总数
  - `totalSize`: 存储总大小（字节）

#### Scenario: 快速响应健康检查
- **WHEN** 收到健康检查请求
- **THEN** 服务必须 (SHALL) 在 100ms 内返回响应（避免阻塞扩展的状态检查）

#### Scenario: 服务异常状态
- **WHEN** 服务遇到内部错误（如存储路径不可访问）
- **THEN** 服务应该 (SHOULD) 返回 500 状态码和错误信息
- **AND** 扩展应该 (SHOULD) 将此视为服务离线

### Requirement: 存储目录配置
代理服务必须 (SHALL) 支持动态配置和更新存储目录。

#### Scenario: 默认存储目录
- **WHEN** 服务启动且未接收到路径配置
- **THEN** 服务必须 (SHALL) 使用默认路径 `~/Downloads/chrome-history`
- **AND** 服务必须 (SHALL) 自动创建该目录（如不存在）

#### Scenario: 配置端点接收路径
- **WHEN** 在 `/config/storage-path` 接收到 POST 请求
- **THEN** 服务必须 (SHALL) 接收包含 `path` 字段的 JSON 数据
- **AND** 服务必须 (SHALL) 验证路径格式（非空、合法字符）
- **AND** 服务必须 (SHALL) 更新存储目录配置
- **AND** 服务必须 (SHALL) 返回配置更新成功的确认消息

**路径验证规则**:
- **非空检查**: 拒绝空字符串或 null
- **非法字符检查**: 拒绝包含以下字符的路径
  - 控制字符（ASCII 0-31）
  - 特殊字符：`<>:"|?*`（Windows）
  - 路径注入：`../`、`..\\`（防止目录遍历）
- **允许的字符**: 所有字母、数字、下划线、连字符、点、斜杠、反斜杠
- **路径长度限制**: 最大 255 字符

#### Scenario: 创建新存储目录
- **WHEN** 配置的新路径不存在
- **THEN** 服务必须 (SHALL) 自动创建目录及必要的子目录结构
- **AND** 服务必须 (SHALL) 设置适当的文件系统权限

**路径不存在时的处理流程**:
- 自动创建完整目录结构（包括父目录）
- 设置权限：
  - macOS/Linux: `755` (rwxr-xr-x)
  - Windows: 继承父目录权限
- 创建失败时返回错误信息：
  - 权限不足
  - 磁盘空间不足
  - 父目录不存在且无法创建

#### Scenario: 路径切换时处理旧图片
- **WHEN** 存储路径配置发生变化
- **THEN** 服务必须 (SHALL) 提示用户选择处理方式

**旧路径图片处理选项**:
- **保留旧图片**: 旧图片保留在原路径，新图片保存到新路径
- **迁移图片**: 将旧图片移动到新路径（可选功能）
- **清空旧图片**: 删除旧路径中的所有图片（需用户确认）

#### Scenario: 获取当前配置
- **WHEN** 在 `/config/storage-path` 接收到 GET 请求
- **THEN** 服务必须 (SHALL) 返回当前配置的存储路径

#### Scenario: 跨平台路径支持
- **WHEN** 用户配置不同操作系统的路径格式
- **THEN** 服务必须 (SHALL) 正确处理：
  - macOS/Linux: 支持 `~` 用户目录符号和绝对路径
  - Windows: 支持盘符路径（如 `C:\Users\...`）
  - 相对路径: 支持相对于服务启动目录的路径

#### Scenario: 路径配置持久化
- **WHEN** 服务重启
- **THEN** 服务必须 (SHALL) 从配置文件或环境变量恢复上次的存储路径配置

### Requirement: 服务启动
代理服务必须 (SHALL) 可通过命令行启动。

#### Scenario: 使用默认设置启动
- **WHEN** 用户运行 `node server.js` 或 `npm start`
- **THEN** 服务必须 (SHALL) 在默认端口（3777）上开始监听

#### Scenario: 使用自定义端口启动
- **WHEN** 用户通过命令行参数指定端口
- **THEN** 服务必须 (SHALL) 在指定端口上监听