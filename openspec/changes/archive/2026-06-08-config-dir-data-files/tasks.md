## 1. CLI 改造

- [x] 1.1 解析配置文件路径，获取 configDir
- [x] 1.2 传递 configDir 给 AIClassify

## 2. AIClassify 改造

- [x] 2.1 构造函数接收 configDir
- [x] 2.2 实现旧文件迁移

## 3. hashIndex 改造

- [x] 3.1 文件名改为 `.ai-classify-index.json`
- [x] 3.2 使用 configDir 存放

## 4. queue 改造

- [x] 4.1 文件名改为 `.ai-classify-queue-tasks.json`
- [x] 4.2 使用 configDir 存放

## 5. 测试

- [x] 5.1 测试新路径
- [x] 5.2 测试旧文件迁移