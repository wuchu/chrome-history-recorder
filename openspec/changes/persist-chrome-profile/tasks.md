## 1. 更新 WXT 配置

- [x] 1.1 修改 `packages/extension/wxt.config.ts`，添加 `path` 和 `os` 导入
- [x] 1.2 添加 `LOCAL_CHROME_PROFILE` 常量，指向项目根目录的 `.chrome-dev-profile`
- [x] 1.3 在 `webExt` 配置中添加 `chromiumProfile` 选项
- [x] 1.4 在 `webExt` 配置中添加 `keepProfileChanges: true`
- [x] 1.5 支持 `CHROME_PROFILE_PATH` 环境变量覆盖

## 2. 更新 Gitignore

- [x] 2.1 在根目录 `.gitignore` 中添加 `.chrome-dev-profile/` 忽略规则

## 3. 测试验证

- [ ] 3.1 运行 `pnpm dev`，验证 Chrome 正常打开
- [ ] 3.2 手动登录 Google 账号，然后停止开发服务器
- [ ] 3.3 再次运行 `pnpm dev`，验证登录状态已保留
- [ ] 3.4 验证 `.chrome-dev-profile/` 目录已创建
- [ ] 3.5 验证 `pnpm dev:no-browser` 仍正常工作
- [ ] 3.6 测试环境变量覆盖：`CHROME_PROFILE_PATH=/custom/path pnpm dev`
