## Context

项目是 monorepo 结构，包含三个子包：
- `packages/extension` - TypeScript + React (WXT)
- `packages/proxy` - JavaScript (Express)
- `packages/ai-classify` - TypeScript CLI

当前状态：
- 无 ESLint/Prettier 配置
- 无 Git hooks
- 文档与实现不一致

约束：
- ESLint 使用 flat config 格式（ESLint 9+）
- 需要支持 TypeScript 和 JavaScript 文件
- 需要兼容 pnpm monorepo

## Goals / Non-Goals

**Goals:**
- 统一的代码风格检查和格式化
- 自动化的 pre-commit 检查
- 文档与实际实现一致
- 最小化的开发者负担

**Non-Goals:**
- 不处理 proxy → TypeScript 迁移（单独的 change）
- 不添加单元测试框架（单独的 change）
- 不修改现有代码逻辑

## Decisions

### Decision 1: ESLint 配置格式

**选择**: Flat Config (`eslint.config.mjs`)

**理由**:
- ESLint 9+ 推荐的新格式
- 更灵活，支持多配置组合
- 替代传统的 `.eslintrc.*` 文件

**Alternative**: 传统 `.eslintrc.json`
- 已被 ESLint 9+ 弃用
- 限制较多

### Decision 2: TypeScript ESLint 集成

**选择**: `typescript-eslint` (官方 TypeScript ESLint 插件)

**理由**:
- 官方支持，与 TypeScript 版本同步更新
- 支持 TypeScript 类型检查规则
- 兼容 flat config

### Decision 3: Prettier 与 ESLint 集成

**选择**: 独立配置，禁用 ESLint 格式化规则

**理由**:
- Prettier 专注格式化，ESLint 专注代码质量
- 使用 `eslint-config-prettier` 禁用 ESLint 的格式化规则
- 避免冲突

### Decision 4: husky 集成方式

**选择**: husky v9 + `.husky/` 目录

**理由**:
- husky v9 使用简化的配置方式
- 支持 pnpm (`pnpm dlx husky init`)
- 与 lint-staged 配合良好

### Decision 5: lint-staged 范围

**选择**: 只检查已修改的文件

**理由**:
- 减少 pre-commit 时间
- 避免全量检查影响效率
- 使用 glob 模式过滤

配置范围：
```
{
  "*.{ts,tsx,js,mjs}": ["eslint --fix", "prettier --write"],
  "*.{json,yaml,md}": ["prettier --write"]
}
```

## Risks / Trade-offs

### Risk 1: ESLint 规则过于严格

**风险**: 过多的错误提示可能降低开发效率

**缓解**: 
- 使用推荐规则集作为基础
- 可以通过 `// eslint-disable-next-line` 暂时禁用
- 规则可以逐步收紧

### Risk 2: husky 与 pnpm 兼容性

**风险**: pnpm 的符号链接可能导致 husky 路径问题

**缓解**:
- 使用 `pnpm dlx husky init` 官方推荐方式
- 确保 `.husky/_/h.sh` 正确配置

### Risk 3: proxy 模块 JavaScript 文件

**风险**: ESLint TypeScript 规则可能不完全适用于 JavaScript

**缓解**:
- 为 JavaScript 文件使用单独的配置
- 不强制类型检查规则