## 1. 修复 TypeScript 编译错误

- [x] 1.1 删除 `MediaList.tsx` 和 `MediaList.module.css`（确认未使用后）
- [x] 1.2 修复 `useSidePanelCapture.ts` 中的 `useBackgroundMessaging` 导入路径

## 2. 修复 ESLint 警告 - Extension

- [x] 2.1 `ollama-client.ts:510:44` - 移除未使用的 `mimeType` 参数
- [x] 2.2 `scheduler.ts:8:27` - 移除未使用的 `ClassificationResult` 导入
- [x] 2.3 `CaptureStream.tsx:7:16` - 移除未使用的 `useState` 导入
- [x] 2.4 `MediaGrid.tsx:7:16` - 移除未使用的 `useState` 导入
- [x] 2.5 `useHistoricalImages.ts:116:51` - 替换 `any` 类型
- [x] 2.6 `App.tsx:91:10` (options) - 移除未使用的 `batchImportText`

## 3. 修复 ESLint 警告 - VFS Service

- [x] 3.1 `integration.test.ts:7:55` - 移除未使用的 `vi` 导入
- [x] 3.2 `integration.test.ts` (多处) - 替换 `any` 类型为具体类型

## 4. 验证修复

- [x] 4.1 运行 `pnpm lint` - 确认无警告
- [x] 4.2 运行 `pnpm --filter extension compile` - 确认无编译错误
- [x] 4.3 运行 `pnpm --filter vfs-service build` - 确认无编译错误
- [x] 4.4 运行 `pnpm build` - 确认完整构建通过
