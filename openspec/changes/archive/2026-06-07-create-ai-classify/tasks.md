## 1. 项目初始化

- [x] 1.1 在根目录创建 `ai-classify/` 子目录
- [x] 1.2 创建 `ai-classify/package.json` 配置（name、version、bin、dependencies）
- [x] 1.3 创建 `ai-classify/tsconfig.json` TypeScript 配置
- [x] 1.4 更新根目录 `pnpm-workspace.yaml` 添加 ai-classify 包
- [x] 1.5 安装依赖：chokidar、commander、fs-extra、axios

## 2. CLI 入口实现

- [x] 2.1 创建 `src/cli.ts` CLI 命令解析（使用 commander）
- [x] 2.2 实现 `start` 命令：启动监控和分类
- [x] 2.3 实现 `status` 命令：显示队列状态
- [x] 2.4 实现 `clear` 命令：清空队列和索引
- [x] 2.5 实现 `reprocess` 命令：重新处理所有文件
- [x] 2.6 配置 package.json bin 字段指向 CLI 入口

## 3. 配置管理

- [x] 3.1 创建 `src/config.ts` 配置加载模块
- [x] 3.2 定义配置结构（input、output、ollamaEndpoint、model、patterns）
- [x] 3.3 实现配置文件 `.ai-classify.json` 读取和写入
- [x] 3.4 实现命令行参数覆盖配置文件

## 4. 目录监控实现

- [x] 4.1 创建 `src/watcher.ts` 目录监控模块
- [x] 4.2 使用 chokidar 实现文件监控
- [x] 4.3 实现文件过滤（glob patterns）
- [x] 4.4 实现递归目录监控
- [x] 4.5 处理 add、change、unlink 事件
- [x] 4.6 集成到主流程，新文件自动入队

## 5. Hash 索引实现

- [x] 5.1 创建 `src/hashIndex.ts` Hash 索引模块
- [x] 5.2 实现 SHA-256 hash 计算
- [x] 5.3 实现索引文件 `index.json` 加载和保存
- [x] 5.4 实现重复检测（hash 查询）
- [x] 5.5 实现索引记录添加和查询

## 6. 任务队列实现

- [x] 6.1 创建 `src/queue.ts` 任务队列模块
- [x] 6.2 定义队列数据结构（pending、processing、failed）
- [x] 6.3 实现队列文件 `queue.json` 加载和保存
- [x] 6.4 实现入队、出队、完成、失败操作
- [x] 6.5 实现优先级排序
- [x] 6.6 实现启动时恢复上次任务

## 7. Ollama 分类器实现

- [x] 7.1 创建 `src/classifier.ts` AI 分类器模块
- [x] 7.2 实现 Ollama API 连接和健康检查
- [x] 7.3 实现图片分类（调用 vision model）
- [x] 7.4 实现文本分类（调用 text model）
- [x] 7.5 定义分类结果结构（category、suggestedName、tags、confidence）
- [x] 7.6 实现错误处理和重试机制

## 8. 文件整理实现

- [x] 8.1 创建 `src/organizer.ts` 文件整理模块
- [x] 8.2 实现文件复制（不修改源文件）
- [x] 8.3 实现基于分类结果的重命名
- [x] 8.4 实现目录结构创建（按类别或日期）
- [x] 8.5 实现文件名冲突处理
- [x] 8.6 实现元数据保留（时间戳）

## 9. 主流程集成

- [x] 9.1 创建 `src/index.ts` 主模块
- [x] 9.2 集成 watcher、classifier、organizer、queue、hashIndex
- [x] 9.3 实现处理循环：检测 → 入队 → 分类 → 整理 → 记录
- [x] 9.4 实现并发控制（限制同时处理数量）
- [x] 9.5 实现优雅停止（完成当前任务后保存状态）

## 10. 类型定义

- [x] 10.1 创建 `src/types.ts` 类型定义
- [x] 10.2 定义 Config、Task、Queue、IndexRecord、ClassificationResult 类型

## 11. 测试与文档

- [ ] 11.1 测试 CLI 命令基本功能
- [ ] 11.2 测试目录监控和文件检测
- [ ] 11.3 测试 Ollama 分类功能
- [ ] 11.4 测试断点续传功能
- [ ] 11.5 测试重复检测功能
- [x] 11.6 创建 README.md 使用文档
- [x] 11.7 编写 CLI 命令说明和示例