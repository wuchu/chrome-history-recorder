## Context

项目包含三个模块：
- `packages/ai-classify` - TypeScript CLI
- `packages/extension` - TypeScript Chrome 扩展
- `packages/proxy` - JavaScript Express 服务（需迁移）

当前状态：
- ESLint 发现 50+ warnings/errors
- proxy 模块无类型检查
- 无单元测试
- 无 CI/CD 流程

## Goals / Non-Goals

**Goals:**
- 所有 ESLint warnings/errors 修复（或降级为 acceptable）
- proxy 模块完全迁移到 TypeScript
- Vitest 测试框架配置完成，有基础测试覆盖
- GitHub Actions CI 配置完成

**Non-Goals:**
- 不实现 100% 测试覆盖率（目标是基础覆盖）
- 不重构现有业务逻辑
- 不改变 API 接口

## Decisions

### Decision 1: ESLint 问题处理策略

**选择**: 分优先级处理

**策略**:
- **高优先级**: errors（no-case-declarations, no-empty, no-control-regex 等）
- **中优先级**: warnings（no-unused-vars, no-explicit-any）
- **低优先级**: 可接受的 warnings（如确实需要 any 的场景）

**处理方式**:
1. errors 必须修复
2. unused vars 通过删除或使用 `_` 前缀处理
3. `any` 类型通过添加具体类型或 `unknown` 处理

### Decision 2: proxy TypeScript 迁移策略

**选择**: 直接迁移，保留 Express 结构

**理由**:
- Express 本身支持 TypeScript
- 不需要改变现有 API 结构
- 可以逐步添加类型

**步骤**:
1. 重命名 `.js` → `.ts`
2. 添加 `tsconfig.json`
3. 修复类型错误
4. 更新 package.json scripts

### Decision 3: 测试框架选择

**选择**: Vitest

**理由**:
- 与 Vite 生态兼容（extension 使用 WXT/Vite）
- 比 Jest 更快
- ESM 支持更好
- TypeScript 支持原生

**Alternative**: Jest
- 成熟但配置复杂
- ESM 支持需要额外配置

### Decision 4: CI/CD 结构

**选择**: 多 workflow 分离

**结构**:
- `lint.yml` - 每次 push 检查 lint
- `test.yml` - 每次 push 运行测试
- `build.yml` - PR 和 release 构建

**触发条件**:
- push to main/develop
- pull_request

## Risks / Trade-offs

### Risk 1: proxy 迁移可能引入类型错误

**风险**: 迁移过程中可能遗漏类型定义

**缓解**: 
- 保持原有逻辑不变
- 先添加基础类型，后续完善
- 运行测试验证

### Risk 2: 测试覆盖率低

**风险**: 基础测试可能不够全面

**缓解**:
- 优先测试核心功能（API endpoints, eventLog）
- 标记需要更多测试的模块
- CI 中添加覆盖率报告

### Risk 3: ESLint 修复可能改变行为

**风险**: 修复某些问题可能影响代码行为

**缓解**:
- 修复后运行现有功能验证
- 只修复明确的问题，不重构