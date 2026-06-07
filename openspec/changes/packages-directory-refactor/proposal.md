## Why

当前项目结构将三个包（extension、proxy、ai-classify）平铺在根目录下，缺乏统一的组织结构。开发时需要分别启动多个服务，操作繁琐：

```bash
npm run dev          # 只启动 extension
npm run dev:proxy    # 只启动 proxy
```

开发调试时需要同时运行 extension（Chrome 扩展）和 proxy（后端服务），当前需要手动启动两个进程。引入 packages/ 目录结构和一键启动命令可以：

1. 改善代码组织的清晰度
2. 简化开发流程，一键启动所有必要服务
3. 符合 monorepo 最佳实践

## What Changes

- **BREAKING** 将 `extension/` 移动到 `packages/extension/`
- **BREAKING** 将 `proxy/` 移动到 `packages/proxy/`
- **BREAKING** 将 `ai-classify/` 移动到 `packages/ai-classify/`
- 新增根目录 `npm run dev` 命令，并发启动所有需要的服务
- 更新 `pnpm-workspace.yaml` 指向新目录
- 更根目录 `package.json` 脚本

## Capabilities

### New Capabilities
- `dev-orchestration`: 开发环境一键启动，并发管理多个服务进程

### Modified Capabilities
- 无（目录结构调整不改变功能需求，仅影响路径配置）

## Impact

- 目录结构变更：所有包路径从根目录移动到 packages/ 子目录
- 配置文件更新：
  - `pnpm-workspace.yaml` 路径更新
  - 根目录 `package.json` 脚本更新
  - 各包内部引用路径可能需要调整
- 开发工作流改善：一个命令启动所有服务
- CI/CD 配置可能需要更新路径（如有）