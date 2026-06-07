## Context

当前项目使用 pnpm workspace 管理三个包，目录结构为平铺式：

```
chrome-history-recoder/
├── extension/        # Chrome 扩展
├── proxy/           # 后端代理服务
├── ai-classify/     # AI 分类功能
├── package.json     # 根目录脚本
└ pnpm-workspace.yaml
```

**约束**：
- 使用 pnpm workspace 管理依赖
- extension 依赖 proxy 运行
- 开发时需要同时启动多个服务
- Git 历史需要保留

## Goals / Non-Goals

**Goals:**
- 将三个包移动到 packages/ 目录下，统一组织结构
- 实现一键启动命令 `npm run dev`，并发启动 extension 和 proxy
- 保持 Git 历史完整性
- 保持现有功能不变

**Non-Goals:**
- 不修改包内部代码逻辑
- 不添加新的服务或包
- 不实现服务依赖检查或启动顺序控制

## Decisions

### 1. 目录结构方案：packages/ 前缀

**选择 packages/ 的原因**：
- 符合 monorepo 最佳实践（pnpm、turborepo、nx 等）
- 与 pnpm workspace 配置一致
- 清晰区分顶层配置和包代码

**备选方案**：
- 保持平铺结构：不够规范，不利于后续扩展
- 使用 apps/ 和 libs/ 分类：当前包类型不明确，过度设计

### 2. 并发启动方案：npm-run-all

**选择 npm-run-all 的原因**：
- 跨平台兼容（Windows/macOS/Linux）
- 支持并行和串行执行
- 轻量级，无额外配置

**备选方案**：
- `concurrently`：功能相似，但 npm-run-all 更简洁
- shell 脚本 `&`：不跨平台，Windows 需要单独处理
- `turbo run`：引入额外复杂度，当前项目规模不需要

### 3. Git 历史保留：git mv

**选择 git mv 的原因**：
- Git 会自动追踪文件移动
- 保留完整提交历史
- 避免删除后重新添加导致的提交断开

**注意事项**：
- 先移动目录，再更新配置
- 移动后验证历史完整性

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 路径引用失效 | 使用 pnpm workspace，包间引用通过包名而非路径 |
| CI/CD 脚本失效 | 检查并更新所有路径引用 |
| IDE 配置失效 | 检查 tsconfig.json、vscode 配置等 |
| Git 大文件移动 | 目录移动不改变文件内容，影响较小 |

## Migration Plan

### Phase 1: 目录移动
1. 使用 `git mv` 移动三个包到 packages/
2. 验证 Git 历史完整性

### Phase 2: 配置更新
1. 更新 `pnpm-workspace.yaml`
2. 更新根目录 `package.json`
3. 检查各包内部配置

### Phase 3: 启动脚本
1. 安装 npm-run-all
2. 配置并发启动脚本
3. 验证一键启动功能

### Rollback Plan
如需回滚：
```bash
git mv packages/extension extension
git mv packages/proxy proxy
git mv packages/ai-classify ai-classify
git checkout package.json pnpm-workspace.yaml
```