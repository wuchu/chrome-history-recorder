## Why

媒体工作区路径目前只能在启动后端时通过 `--workspace` / `-w` 指定，默认固定为 `~/.vfs-workspace`。`pnpm dev` 等启动脚本不方便透传参数，扩展 Options 里也看不到当前路径，想放到外置盘或自定义目录的用户只能改命令行。需要让用户在 Options 控制台中配置工作区路径，同时让"配置在哪里、改完何时生效、旧数据怎么办"都明确可预期。

## What Changes

- 新增工作区路径解析优先级：`--workspace` / `-w` ＞ `VFS_WORKSPACE` 环境变量 ＞ 用户级 launcher 配置 ＞ 默认 `~/.vfs-workspace`。
- 新增用户级 launcher 配置文件（位于工作区之外）保存自定义路径，原子写入；**不改** `workspace/config.json`——该文件在工作区内，打开工作区之前无法读取。
- VFS 配置解析支持 `VFS_WORKSPACE` 环境变量，独立 `vfs` 入口同样生效。
- app 扩展 `getWorkspaceConfig` 响应为 `{ path, defaultPath, source, pendingPath? }`，扩展可区分当前路径来源和"待重启生效"的路径。
- app 新增 `setWorkspacePath` RPC：校验目标路径、写入 launcher 配置、返回 `{ success, restartRequired: true }`；运行期不切换工作区。
- Options「设置」页新增「存储与工作空间」卡片：展示当前路径、来源、待生效路径；支持输入并保存新路径；CLI/env 覆盖时只读并说明原因；保存成功后提示重启后端生效。
- 目标目录语义：不存在或为空 → 新建工作区；含 `vfs.db` → 采用已有工作区；非空且无 `vfs.db` → 拒绝。
- 切换路径不移动、不复制、不删除旧工作区数据；旧工作区原地保留。
- 启动时若配置的工作区不可用（如外置盘未挂载），后端**失败退出**并给出明确错误、launcher 配置路径与恢复方式，不自动回退到默认或历史路径。
- 收敛重复的默认路径定义（`vfs/src/config.ts` 与 `vfs/src/sqlite.ts`）和两个入口的参数解析逻辑。

无破坏性变更；未配置时行为与现在完全一致。

## Capabilities

### New Capabilities

- `app-workspace-selection`: 工作区路径的优先级解析、用户级 launcher 配置、目标路径校验、`getWorkspaceConfig` / `setWorkspacePath` RPC、重启生效语义与启动失败策略。

### Modified Capabilities

- `vfs-service`: 工作区配置新增 `VFS_WORKSPACE` 环境变量及"CLI ＞ 环境变量 ＞ 默认"的解析优先级。
- `extension-options-config`: Settings 页新增「存储与工作空间」设置卡片，展示与修改工作区路径。

## Impact

- `packages/vfs/src/config.ts`：环境变量支持、返回 `source`、收敛默认路径。
- `packages/vfs/src/sqlite.ts`：移除重复的 `getDefaultWorkspacePath`。
- `packages/vfs/src/index.ts`、`packages/app/src/index.ts`：使用共享解析结果。
- `packages/app/src/workspace-config.ts`（新增）：launcher 配置读写、校验、路径解析。
- `packages/app/src/handlers.ts`：覆盖 `getWorkspaceConfig`，新增 `setWorkspacePath`。
- `packages/extension/src/background/vfs-ws-client.ts`：新增 `setWorkspacePath` 客户端方法，扩展 `getWorkspaceConfig` 类型。
- `packages/extension/src/entrypoints/options/App.tsx`：Settings 页新增工作区卡片。
- 测试：`packages/vfs/test/config.test.ts`（若不存在则新增）、`packages/vfs/test/api.test.ts`、`packages/vfs/test/integration.test.ts`、`packages/app/test/workspace-config.test.ts`（新增）。
- 文档：`README.md` 与 `ARCHITECTURE.md` 的工作空间配置章节。
- 无新增依赖；端口配置（`VFS_WS_PORT` / `VFS_HTTP_PORT`）机制不变。
