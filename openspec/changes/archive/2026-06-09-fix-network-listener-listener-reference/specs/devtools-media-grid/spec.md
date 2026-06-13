## MODIFIED Requirements

### Requirement: NetworkListener 监听器管理
NetworkListener 必须 (SHALL) 正确管理 Chrome DevTools 网络请求监听器的注册和移除。

#### Scenario: 监听器正确注册
- **WHEN** `startListening()` 被调用
- **THEN** 系统必须 (SHALL) 使用相同的函数引用注册监听器
- **AND** 系统必须 (SHALL) 缓存绑定后的函数引用

#### Scenario: 监听器正确移除
- **WHEN** `stopListening()` 被调用
- **THEN** 系统必须 (SHALL) 使用相同的函数引用移除监听器
- **AND** 监听器 必须 (SHALL) 被完全移除

#### Scenario: React StrictMode 兼容
- **WHEN** 组件经历多次挂载/卸载（React StrictMode）
- **THEN** 系统必须 (SHALL) 每次正确移除监听器
- **AND** 系统必须 (SHALL) 不残留监听器