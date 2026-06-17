## 1. 修改 vfs-service 配置

- [x] 1.1 移除 vfs-service/package.json 中的 `"type": "module"`
- [x] 1.2 更新 vfs-service/tsconfig.json：`module` 改为 Node16，`moduleResolution` 改为 Node16

## 2. 更新 vfs-service 源文件导入

- [x] 2.1 更新 `vfs-service/src/api.ts` - 移除所有 `.js` 后缀
- [x] 2.2 更新 `vfs-service/src/blob.ts` - 移除所有 `.js` 后缀
- [x] 2.3 更新 `vfs-service/src/config.ts` - 移除所有 `.js` 后缀
- [x] 2.4 更新 `vfs-service/src/dispatcher.ts` - 移除所有 `.js` 后缀
- [x] 2.5 更新 `vfs-service/src/http-server.ts` - 移除所有 `.js` 后缀
- [x] 2.6 更新 `vfs-service/src/index.ts` - 移除所有 `.js` 后缀
- [x] 2.7 更新 `vfs-service/src/sqlite.ts` - 移除所有 `.js` 后缀
- [x] 2.8 更新 `vfs-service/src/thumbnail.ts` - 移除所有 `.js` 后缀
- [x] 2.9 更新 `vfs-service/src/websocket-server.ts` - 移除所有 `.js` 后缀

## 3. 更新 vfs-service 测试文件导入

- [x] 3.1 更新 `vfs-service/test/api.test.ts` - 移除所有 `.js` 后缀
- [x] 3.2 更新 `vfs-service/test/blob.test.ts` - 移除所有 `.js` 后缀
- [x] 3.3 更新 `vfs-service/test/integration.test.ts` - 移除所有 `.js` 后缀
- [x] 3.4 更新 `vfs-service/test/sqlite.test.ts` - 移除所有 `.js` 后缀

## 4. 统一 extension 导入风格

- [x] 4.1 更新 `extension/src/background/file-manager.ts` - 移除 `.js` 后缀
- [x] 4.2 更新 `extension/src/background/classify/scheduler.ts` - 移除所有 `.js` 后缀

## 5. 验证修复

- [x] 5.1 运行 `pnpm --filter vfs-service build` - 确认编译通过
- [x] 5.2 运行 `pnpm --filter vfs-service test` - 确认测试通过
- [x] 5.3 运行 `pnpm --filter extension compile` - 确认编译通过
- [x] 5.4 运行 `pnpm build` - 确认完整构建通过
- [x] 5.5 运行 `pnpm lint` - 确认没有 lint 错误
