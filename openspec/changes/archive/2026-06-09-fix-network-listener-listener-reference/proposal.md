## Why

NetworkListener 类的 `startListening` 和 `stopListening` 方法使用 `.bind(this)` 创建监听器函数，但每次调用 `.bind()` 都会创建新的函数引用，导致 `removeListener` 无法正确移除监听器。

在 React StrictMode 下，组件会经历两次挂载/卸载，导致：
1. 第一次挂载注册监听器 A
2. 第一次卸载尝试移除监听器 B（失败，因为 A ≠ B）
3. 第二次挂载注册监听器 C
4. 多个监听器活跃，但 NetworkListener 实例的 `capturedImages` 丢失

结果是：图片被捕获并保存到 Proxy，但 UI 显示空列表。

## What Changes

- 在 NetworkListener 类中缓存 `.bind(this)` 的结果，使用相同的函数引用注册和移除监听器

## Capabilities

### Modified Capabilities

- `devtools-media-grid`: 修复 NetworkListener 监听器引用问题，确保数据正确传递到 UI

## Impact

- **packages/extension/src/utils/networkListener.ts**: 添加 `boundHandleRequest` 属性缓存绑定函数
- **packages/extension/src/entrypoints/devtools-panel/hooks/useNetworkListener.ts**: 可能需要确保 cleanup 正确调用 stopListening