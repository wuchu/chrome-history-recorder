## 1. 目录结构迁移

- [x] 1.1 创建 packages/ 目录
- [x] 1.2 使用 git mv 移动 extension 到 packages/extension
- [x] 1.3 使用 git mv 移动 proxy 到 packages/proxy
- [x] 1.4 使用 git mv 移动 ai-classify 到 packages/ai-classify
- [x] 1.5 验证 Git 历史完整性（git log 检查）

## 2. Workspace 配置更新

- [x] 2.1 更新 pnpm-workspace.yaml 指向 packages/*
- [x] 2.2 更新根目录 package.json 的包引用路径
- [x] 2.3 检查并更新各包内部的 tsconfig.json paths（如有）
- [x] 2.4 运行 pnpm install 验证依赖正确解析

## 3. 并发启动脚本配置

- [x] 3.1 安装 npm-run-all 开发依赖
- [x] 3.2 更新根目录 package.json dev 脚本为并发启动
- [x] 3.3 配置并行启动 extension 和 proxy
- [x] 3.4 测试 npm run dev 一键启动功能

## 4. 配置文件检查

- [x] 4.1 检查 .gitignore 路径是否需要更新
- [x] 4.2 检查 README.md 中的路径引用
- [x] 4.3 检查 openspec 相关路径（如有影响）

## 5. 测试验证

- [x] 5.1 测试 extension 单独启动（pnpm --filter extension dev）
- [x] 5.2 测试 proxy 单独启动（pnpm --filter proxy dev）
- [x] 5.3 测试一键启动（npm run dev）
- [x] 5.4 测试 Ctrl+C 停止所有服务
- [x] 5.5 测试构建命令（npm run build）