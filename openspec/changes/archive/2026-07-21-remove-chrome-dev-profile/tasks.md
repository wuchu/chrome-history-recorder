## 1. 更新 WXT 配置

- [x] 1.1 修改 `packages/extension/wxt.config.ts`
  - [x] 移除 `path` 和 `fileURLToPath` 导入（如果不再使用）
  - [x] 移除 `LOCAL_CHROME_PROFILE` 常量
  - [x] 修改 `webExt` 配置，移除 `chromiumProfile`
  - [x] 移除 `keepProfileChanges: true`
  - [x] 保留 `CHROME_PROFILE_PATH` 环境变量的条件支持

## 2. 删除物理目录

- [x] 2.1 删除项目根目录下的 `.chrome-dev-profile/` 目录

## 3. 测试验证

- [x] 3.1 运行 `pnpm dev`，验证 Chrome 正常打开（使用临时 profile）
- [x] 3.2 验证 `pnpm dev:no-browser` 仍正常工作
- [x] 3.3 测试环境变量仍可用：`CHROME_PROFILE_PATH=/some/path pnpm dev`（可选）
- [x] 3.4 运行 `pnpm build`，验证生产构建不受影响
