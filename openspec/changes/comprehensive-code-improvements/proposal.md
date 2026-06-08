## Why

项目刚刚添加了 ESLint/Prettier 工具链，运行 lint 发现了多个代码质量问题。同时，proxy 模块仍使用 JavaScript，缺少类型安全。此外，项目没有自动化测试和 CI/CD 流程，代码质量难以保障。

本次优化将：
1. 修复 ESLint 发现的所有 warnings 和 errors
2. 将 proxy 模块迁移到 TypeScript
3. 添加 Vitest 单元测试框架
4. 配置 GitHub Actions CI/CD

## What Changes

### 1. ESLint 问题修复
- 修复未使用的变量和导入
- 移除不必要的 `any` 类型
- 修复 `no-case-declarations`、`no-empty` 等问题
- 移除不必要的 try/catch 包装

### 2. proxy → TypeScript 迁移
- 将 `packages/proxy/src/*.js` 迁移为 `*.ts`
- 添加类型定义和接口
- 更新 package.json 和 tsconfig.json
- **BREAKING**: proxy 模块将使用 TypeScript 编译

### 3. 单元测试框架
- 添加 Vitest 测试框架
- 为 ai-classify 模块添加基础测试
- 为 proxy 模块添加 API 测试

### 4. GitHub Actions CI/CD
- 添加 lint 检查 workflow
- 添加测试 workflow
- 添加 build workflow

## Capabilities

### New Capabilities

- `unit-testing`: Vitest 测试框架配置和基础测试
- `ci-cd`: GitHub Actions 自动化流程

### Modified Capabilities

- `local-storage-proxy`: proxy 模块从 JavaScript 改为 TypeScript

## Impact

- **修改文件**:
  - `packages/ai-classify/src/*.ts` - ESLint 问题修复
  - `packages/extension/src/*.ts` - ESLint 问题修复
  - `packages/proxy/src/*.js` → `*.ts` - TypeScript 迁移

- **新增文件**:
  - `packages/proxy/tsconfig.json`
  - `vitest.config.ts` (根目录)
  - `.github/workflows/*.yml`

- **新增依赖**:
  - vitest
  - @vitest/coverage-v8
  - TypeScript 相关依赖 (proxy)