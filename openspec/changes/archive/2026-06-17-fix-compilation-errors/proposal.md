## Why

项目在最近的重构提交 (3496ac5) 后出现了编译错误和警告，导致无法正常构建。问题包括：

- TypeScript 编译错误：2个模块找不到
- ESLint 警告：44个问题（未使用变量、any类型等）

这些问题阻碍了开发和发布流程。

## What Changes

### 修复的问题

1. **TypeScript 编译错误修复**
   - 修复 `MediaList.tsx` 中缺失的 `networkListener` 导入（该文件已被废弃，应移除以保持一致性）
   - 修复 `useSidePanelCapture.ts` 中缺失的 `useBackgroundMessaging` 导入（该文件已移动到 `media-browser/hooks/`）

2. **ESLint 警告清理**
   - 移除未使用的导入和变量
   - 替换 `any` 类型为具体类型
   - 修复测试文件中的问题

### 影响的文件

| 文件 | 变更 |
|------|------|
| `MediaList.tsx` | 移除（已废弃）或修复导入 |
| `useSidePanelCapture.ts` | 修复 `useBackgroundMessaging` 导入路径 |
| `ollama-client.ts` | 移除未使用的 `mimeType` 参数 |
| `scheduler.ts` | 移除未使用的 `ClassificationResult` 导入 |
| `CaptureStream.tsx` | 移除未使用的 `useState` 导入 |
| `MediaGrid.tsx` | 移除未使用的 `useState` 导入 |
| `useHistoricalImages.ts` | 替换 `any` 类型 |
| `App.tsx` (options) | 移除未使用的 `batchImportText` |
| `integration.test.ts` | 修复 `any` 类型和未使用的 `vi` |

## Capabilities

### Modified Capabilities

- `devtools-media-grid`: 修复编译错误，保持功能完整
- `extension-classify-controls`: 清理 ESLint 警告

## Impact

- 无功能变更，仅修复编译问题
- 确保代码符合 TypeScript 和 ESLint 规则
- 项目可以正常构建和开发
