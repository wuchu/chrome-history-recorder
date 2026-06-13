## Why

项目当前缺少统一的开发工具链配置，导致代码质量难以保证、代码风格不一致、文档与实际实现不匹配。这些问题会影响代码的可维护性和团队协作效率。

具体问题：
1. **文档不一致**: ai-classify README 描述的配置文件格式和 CLI 参数与实际实现不符
2. **缺少代码规范**: 无 ESLint/Prettier 配置，代码风格可能不一致
3. **缺少 Git hooks**: 无 pre-commit 检查，可能引入格式不规范或有问题的代码

## What Changes

- 更新 ai-classify README.md，修正配置文件格式说明（`.ai-classify.yaml`而非 `.json`）
- 更新 CLI 参数说明，反映实际的交互式配置方式
- 添加 ESLint 配置（flat config 格式，ESLint 9+）
- 添加 Prettier 配置
- 添加 husky pre-commit hooks
- 添加 lint-staged 配置
- 更新根 package.json 添加 lint 相关脚本

## Capabilities

### New Capabilities

- `dev-toolchain`: 统一的开发工具链配置，包括 ESLint、Prettier、husky、lint-staged

### Modified Capabilities

无（这是开发工具改进，不改变现有功能的行为）

## Impact

- **新增文件**: 
  - `eslint.config.mjs` (根目录)
  - `.prettierrc.mjs` (根目录)
  - `.husky/pre-commit` (根目录)
  - `.lintstagedrc.mjs` (根目录)

- **修改文件**:
  - `packages/ai-classify/README.md`
  - `package.json` (添加 lint 脚本)
  - 各子包的 `package.json` (可能需要调整)

- **新增依赖**:
  - eslint
  - prettier
  - husky
  - lint-staged
  - @eslint/js
  - typescript-eslint