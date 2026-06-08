## ADDED Requirements

### Requirement: 插件接口定义
Proxy 服务必须 (SHALL) 提供标准化的插件接口，支持第三方扩展。

#### Scenario: 定义插件元数据结构
- **WHEN** 插件被加载
- **THEN** 系统必须 (SHALL) 要求插件提供以下元数据：
  - `name`: 插件名称（字符串，唯一标识）
  - `version`: 插件版本（语义化版本号）
  - `description`: 插件描述（可选）

#### Scenario: 定义生命周期钩子
- **WHEN** 插件被加载或卸载
- **THEN** 系统必须 (SHALL) 提供以下生命周期回调：
  - `onLoad(context)`: 插件加载时调用，接收 PluginContext
  - `onUnload()`: 插件卸载时调用，进行清理

#### Scenario: 提供插件上下文
- **WHEN** 插件 onLoad 被调用
- **THEN** 系统必须 (SHALL) 通过 PluginContext 提供以下 API：
  - `proxy.getConfig()`: 获取 Proxy 配置
  - `proxy.getStoragePath()`: 获取存储路径
  - `proxy.getFile(hash)`: 获取文件
  - `proxy.getFiles(query)`: 查询文件列表
  - `proxy.saveFile(data)`: 保存文件
  - `proxy.deleteFile(hash)`: 删除文件
  - `config`: 插件专属配置
  - `logger`: 日志实例
  - `emit(event, data)`: 发射事件

### Requirement: 文件处理钩子
插件系统必须 (SHALL) 提供文件处理各阶段的钩子点。

#### Scenario: 文件保存后钩子
- **WHEN** 文件成功保存到存储
- **THEN** 系统必须 (SHALL) 调用所有已注册插件的 `afterSave` 钩子
- **AND** 钩子必须 (SHALL) 接收 SavedFile 对象：
  - `hash`: 文件哈希
  - `filename`: 保存的文件名
  - `mimeType`: MIME 类型
  - `size`: 文件大小
  - `path`: 存储路径
  - `url`: 来源 URL
  - `capturedAt`: 捕获时间

#### Scenario: 文件删除前钩子
- **WHEN** 文件即将被删除
- **THEN** 系统必须 (SHALL) 调用所有已注册插件的 `beforeDelete` 钩子
- **AND** 钩子必须 (SHALL) 接收 StoredFile 对象
- **AND** 钩子可以 (MAY) 返回 false 阻止删除

#### Scenario: 文件列表前钩子
- **WHEN** 文件列表查询即将执行
- **THEN** 系统应该 (SHOULD) 调用 `beforeList` 钩子
- **AND** 钩子可以 (MAY) 修改查询参数

#### Scenario: 文件列表后钩子
- **WHEN** 文件列表查询完成
- **THEN** 系统应该 (SHOULD) 调用 `afterList` 钩子
- **AND** 钩子可以 (MAY) 修改返回结果（如添加额外元数据）

### Requirement: API 路由扩展
插件系统必须 (SHALL) 允许插件扩展 Proxy API 路由。

#### Scenario: 注册插件路由
- **WHEN** 插件加载完成
- **THEN** 系统必须 (SHALL) 支持插件注册自定义 HTTP 路由
- **AND** 路由必须 (SHALL) 定义：
  - `path`: 路由路径（如 `/classify/status`）
  - `method`: HTTP 方法（GET/POST/PUT/DELETE）
  - `handler`: 请求处理函数

#### Scenario: 路由命名空间
- **WHEN** 插件注册路由
- **THEN** 系统应该 (SHOULD) 为路由提供命名空间隔离
- **AND** 建议路由路径格式为 `/plugins/<plugin-name>/<action>`

#### Scenario: 插件路由文档
- **WHEN** Proxy 启动完成
- **THEN** 系统应该 (SHOULD) 在启动信息中列出所有插件扩展的路由

### Requirement: 插件发现机制
Proxy 服务必须 (SHALL) 自动发现和加载插件。

#### Scenario: 扫描本地插件目录
- **WHEN** Proxy 启动
- **THEN** 系统必须 (SHALL) 扫描 `plugins/` 目录
- **AND** 系统必须 (SHALL) 识别包含 `plugin.js` 或 `plugin.ts` 的子目录

#### Scenario: 扫描 npm 包插件
- **WHEN** Proxy 启动
- **THEN** 系统必须 (SHALL) 扫描 `node_modules/@proxy-plugin/` 目录
- **AND** 系统必须 (SHALL) 识别符合命名规范的 npm 包

#### Scenario: 加载顺序
- **WHEN** 多个插件被发现
- **THEN** 系统必须 (SHALL) 按配置中的 priority 字段排序加载
- **AND** 未配置 priority 的插件应该 (SHOULD) 按发现顺序加载

#### Scenario: 加载失败处理
- **WHEN** 插件加载失败
- **THEN** 系统必须 (SHALL) 记录错误日志
- **AND** 系统必须 (SHALL) 继续加载其他插件
- **AND** 系统必须 (SHALL) 在状态 API 中标记该插件为 failed

### Requirement: 插件配置
Proxy 服务必须 (SHALL) 支持插件配置管理。

#### Scenario: 插件配置文件
- **WHEN** Proxy 配置文件存在
- **THEN** 系统必须 (SHALL) 从 `proxy-config.yaml` 的 `plugins` 字段读取插件配置
- **AND** 配置格式必须 (SHALL) 支持：
  - `enabled`: 是否启用（布尔值）
  - `priority`: 加载优先级（数字）
  - `config`: 插件专属配置（对象）

#### Scenario: 插件启用/禁用
- **WHEN** 插件配置中 `enabled` 为 false
- **THEN** 系统必须 (SHALL) 不加载该插件
- **AND** 系统必须 (SHALL) 在状态中标记为 disabled

#### Scenario: 配置传递给插件
- **WHEN** 插件 onLoad 被调用
- **THEN** 系统必须 (SHALL) 通过 context.config 传递插件专属配置

### Requirement: 插件状态 API
Proxy 服务必须 (SHALL) 提供插件状态查询 API。

#### Scenario: 列出所有插件
- **WHEN** GET `/plugins` 请求
- **THEN** 系统必须 (SHALL) 返回所有已发现插件的状态列表
- **AND** 返回必须 (SHALL) 包含每个插件的：
  - `name`: 插件名称
  - `status`: 状态
  - `version`: 版本
  - `hooks`: 已注册的钩子列表
  - `routes`: 已注册的路由列表

#### Scenario: 查询特定插件状态
- **WHEN** GET `/plugins/:name/status` 请求
- **THEN** 系统必须 (SHALL) 返回该插件的详细状态
- **AND** 状态可以 (MAY) 包含插件自定义的状态数据

#### Scenario: 插件状态图标
- **WHEN** Proxy 启动信息显示
- **THEN** 系统必须 (SHALL) 使用图标表示插件状态：
  - ● running: 正在运行
  - ○ disabled: 已禁用
  - ✗ failed: 加载失败
  - ◐ loading: 正在加载

### Requirement: 插件依赖管理
插件系统应该 (SHOULD) 支持插件依赖声明。

#### Scenario: 声明插件依赖
- **WHEN** 插件定义 dependencies 字段
- **THEN** 系统应该 (SHOULD) 验证依赖插件是否已加载
- **AND** 依赖插件应该 (SHOULD) 先于当前插件加载

#### Scenario: 依赖缺失处理
- **WHEN** 插件依赖的其他插件未加载
- **THEN** 系统应该 (SHOULD) 记录警告日志
- **AND** 系统可以 (MAY) 禁用该插件或继续加载

### Requirement: 插件隔离
插件系统必须 (SHALL) 确保插件间的隔离和稳定性。

#### Scenario: 钩子错误隔离
- **WHEN** 某个插件的钩子函数抛出错误
- **THEN** 系统必须 (SHALL) 捕获错误并记录日志
- **AND** 系统必须 (SHALL) 继续调用其他插件的钩子
- **AND** 系统必须 (SHALL) 不影响主 Proxy 服务运行

#### Scenario: 路由错误隔离
- **WHEN** 插件路由处理函数抛出错误
- **THEN** 系统必须 (SHALL) 捕获错误并返回 500 错误
- **AND** 系统必须 (SHALL) 不影响其他路由和主服务

#### Scenario: 插件卸载清理
- **WHEN** 插件 onUnload 被调用
- **THEN** 系统必须 (SHALL) 清理该插件注册的所有钩子和路由
- **AND** 系统必须 (SHALL) 不残留插件资源