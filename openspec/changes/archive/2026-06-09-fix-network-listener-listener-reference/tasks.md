## 1. 修复 NetworkListener 监听器引用

- [x] 1.1 在 NetworkListener 类中添加 `boundHandleRequest` 属性
- [x] 1.2 在类初始化时缓存 `this.handleRequest.bind(this)`
- [x] 1.3 修改 `startListening()` 使用缓存的绑定函数
- [x] 1.4 修改 `stopListening()` 使用缓存的绑定函数

## 2. 验证修复

- [x] 2.1 重新编译 Extension
- [ ] 2.2 测试 React StrictMode 下监听器正确清理
- [ ] 2.3 测试捕获图片后 UI 正确显示
- [ ] 2.4 测试 DevTools 面板关闭后监听器被移除

## 3. 清理调试日志（可选）

- [ ] 3.1 移除或降低调试日志级别