## Context

在最近的重构提交 (3496ac5) 中，部分文件被删除或移动，但仍有其他文件在引用它们，导致了编译错误。同时，存在一些 ESLint 警告需要清理。

### 问题详细分析

**TypeScript 编译错误：**

1. `MediaList.tsx` 导入 `../../../utils/networkListener` - 该文件已在重构中删除
   - 原因：`networkListener.ts` 是旧版 DevTools 面板的遗留代码，已被新的架构替代
   - 现状：`MediaList.tsx` 在 `components.ts` 中未被导出，看起来也是遗留代码

2. `useSidePanelCapture.ts` 导入 `../../devtools-panel/hooks/useBackgroundMessaging` - 该目录已被删除
   - 原因：`useBackgroundMessaging.ts` 已移动到 `media-browser/hooks/` 目录
   - 解决方案：更新导入路径

**ESLint 警告：**

1. 未使用的变量/导入 - 可以安全删除
2. `any` 类型 - 需要替换为具体类型

## Goals / Non-Goals

**Goals:**
- 修复所有 TypeScript 编译错误
- 清理所有 ESLint 警告
- 保持现有功能不变
- 确保 `pnpm build` 和 `pnpm lint` 能够通过

**Non-Goals:**
- 不进行功能变更
- 不重构架构
- 不添加新功能

## Decisions

### 1. 关于 `MediaList.tsx`

**决定：删除该文件**

理由：
- 该文件在 `components.ts` 中未被导出
- 它引用的 `networkListener` 已被删除
- 新架构使用 `MediaGrid.tsx` 和 `VirtualMasonryGrid.tsx` 替代
- 删除可以保持代码库整洁

### 2. 关于 `useSidePanelCapture.ts`

**决定：修复导入路径**

新路径：`../../media-browser/hooks/useBackgroundMessaging`

### 3. 关于 ESLint 警告

**决定：逐个修复**

| 警告类型 | 处理方式 |
|---------|---------|
| 未使用的导入/变量 | 删除 |
| `any` 类型 | 替换为具体类型 |

## Risks / Trade-offs

**风险：** 删除 `MediaList.tsx` 可能会影响某些功能
→ **缓解：** 先确认该文件未被使用，再删除；如果发现有使用，可以恢复并修复导入

**风险：** 替换 `any` 类型可能导致类型错误
→ **缓解：** 编译检查确保类型正确
