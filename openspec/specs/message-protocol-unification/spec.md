# Message Protocol Unification

## Purpose

Unify Chrome Extension message names, parameters, and responses so DevTools, Content Scripts, and Background use one consistent protocol.

## Requirements

### Requirement: 消息类型命名规范
Chrome Extension 消息协议必须 (SHALL) 使用统一的命名规范。

#### Scenario: 消息类型使用 camelCase
- **WHEN** 发送 Chrome Extension 消息
- **THEN** 消息 `type` 字段必须 (SHALL) 使用 camelCase 格式
- **AND** 禁止使用 (MUST NOT) kebab-case 格式（如 'list-files'）
- **AND** 示例必须 (SHALL) 为：'listFiles', 'deleteFile', 'captureMedia'

#### Scenario: 消息处理器统一格式
- **WHEN** Background Worker 处理消息
- **THEN** 消息处理器必须 (SHALL) 使用与发送方一致的 camelCase 类型字符串
- **AND** 消息处理器应该 (SHOULD) 在 switch 语句中显式列出所有支持的消息类型

### Requirement: 消息参数格式规范
Chrome Extension 消息协议必须 (SHALL) 使用统一的参数格式。

#### Scenario: 查询参数使用 query 包装
- **WHEN** 发送需要查询参数的消息（如 listFiles）
- **THEN** 系统必须 (SHALL) 将查询参数包装在 `query` 对象中
- **AND** 格式必须 (SHALL) 为：`{ type: 'listFiles', query: { limit: 10, offset: 0 } }`
- **AND** 禁止使用 (MUST NOT) 直接在消息顶层传递查询参数

#### Scenario: 操作参数使用命名字段
- **WHEN** 发送需要操作参数的消息（如 deleteFile）
- **THEN** 系统必须 (SHALL) 使用命名参数字段
- **AND** 格式必须 (SHALL) 为：`{ type: 'deleteFile', hash: 'abc123', hard: false }`

### Requirement: 消息响应格式规范
Chrome Extension 消息协议必须 (SHALL) 使用统一的响应格式。

#### Scenario: 成功响应格式
- **WHEN** 消息处理成功
- **THEN** 响应必须 (SHALL) 使用 `{ success: true, data: <result> }` 格式
- **AND** `data` 字段必须 (SHALL) 包含实际返回数据
- **AND** 禁止使用 (MUST NOT) 直接返回数据（如旧格式）

#### Scenario: 错误响应格式
- **WHEN** 消息处理失败
- **THEN** 响应必须 (SHALL) 使用 `{ success: false, error: <message> }` 格式
- **AND** `error` 字段必须 (SHALL) 包含错误描述字符串

#### Scenario: 响应处理逻辑
- **WHEN** DevTools Panel 或 Content Script 接收响应
- **THEN** 系统必须 (SHALL) 首先检查 `success` 字段
- **AND** 如果 `success` 为 false，系统必须 (SHALL) 抛出包含 `error` 信息的错误
- **AND** 如果 `success` 为 true，系统必须 (SHALL) 从 `data` 字段提取数据

### Requirement: 消息类型定义文件
系统必须 (SHALL) 提供集中的消息类型定义文件。

#### Scenario: 消息类型常量定义
- **WHEN** 创建消息类型定义文件
- **THEN** 文件应该 (SHOULD) 定义所有消息类型常量
- **AND** 常量命名应该 (SHOULD) 为 UPPER_CASE 格式
- **AND** 值必须 (SHALL) 为 camelCase 字符串

#### Scenario: TypeScript 类型定义
- **WHEN** 创建消息类型定义文件
- **THEN** 文件应该 (SHOULD) 定义消息和响应的 TypeScript 接口
- **AND** 接口必须 (SHALL) 明确标注必需字段和可选字段
