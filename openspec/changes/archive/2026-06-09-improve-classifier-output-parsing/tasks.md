## 1. Prompt 改造

- [x] 1.1 重写 `buildPrompt` 函数，使用管道分隔格式
- [x] 1.2 中文版本：分类中文，文件名英文
- [x] 1.3 英文版本：分类英文，文件名英文
- [x] 1.4 移除 `imgCategories` 相关提示（可选）

## 2. 解析逻辑改造

- [x] 2.1 管道分隔解析
- [x] 2.2 空格分隔解析 (fallback 1)
- [x] 2.3 JSON 解析保留 (fallback 2)
- [x] 2.4 原文件名 fallback (最终兜底)
- [x] 2.5 添加 `sanitizeFilename` 函数
- [x] 2.6 添加 `sanitizeCategory` 函数

## 3. 函数签名调整

- [x] 3.1 `parseClassificationResult` 增加 `originalPath` 参数

## 4. 测试验证

- [x] 4.1 编译 TypeScript
- [x] 4.2 测试管道分隔格式解析
- [x] 4.3 测试空格分隔格式解析
- [x] 4.4 测试 JSON 格式解析 (兼容性)
- [x] 4.5 测试文件名清理