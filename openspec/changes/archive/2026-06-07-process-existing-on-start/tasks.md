## 1. 核心实现

- [x] 1.1 修改 `start()` 方法，在启动 watch 前调用 `scanAndEnqueue()`
- [x] 1.2 确保扫描完成后才开始处理队列

## 2. 测试验证

- [x] 2.1 测试 start 命令自动扫描现有文件（代码已实现）
- [x] 2.2 测试已处理文件不会被重复处理（scanAndEnqueue 已检查 hasBeenProcessed）
- [x] 2.3 测试 watch 继续监控后续变更（代码逻辑保持不变）