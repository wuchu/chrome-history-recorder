## Why

当前项目导入风格不一致，造成困惑：
- `vfs-service` 使用 NodeNext ESM，需要 `.js` 后缀
- `extension` 使用 Bundler，不需要后缀
- 代码风格不统一，新人容易混淆

既然已经是 TypeScript 了，不应该在源码里手动写 `.js` 后缀——这应该让 TypeScript 编译器去处理。

## What Changes

### 修改 vfs-service 的模块系统
- 从 `NodeNext` 改为 `Node16` 或 `CommonJS`
- 移除所有 `.js` 后缀的导入
- 更新 package.json 中的 `type` 字段（如果需要）

### 统一 extension 导入风格
- 检查并移除 extension 中残留的 `.js` 后缀
- 确保所有 extension 导入都没有后缀

## Capabilities

### Modified Capabilities
- `vfs-service` - 更新模块系统，移除导入后缀
- `extension` - 统一导入风格

## Impact

| Package | Changes |
|---------|---------|
| `vfs-service` | tsconfig.json 配置更新 + 所有源文件导入更新 + 测试文件导入更新 |
| `extension` | 少数文件（background/）移除 `.js` 后缀 |
