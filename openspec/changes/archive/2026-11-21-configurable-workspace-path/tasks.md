## 1. VFS 配置解析

- [x] 1.1 在 `packages/vfs/src/config.ts` 的 `parseArgs` 中支持 `VFS_WORKSPACE` 环境变量，优先级为 `--workspace` / `-w` ＞ 环境变量 ＞ 默认路径
- [x] 1.2 在 `VFSConfig` 中增加 `source: 'cli' | 'env' | 'default'` 并返回解析来源
- [x] 1.3 删除 `packages/vfs/src/sqlite.ts` 中重复的 `getDefaultWorkspacePath`，改为从 `config.ts` 导入或重导出
- [x] 1.4 更新 `packages/vfs/src/index.ts` 的启动日志，输出解析来源
- [x] 1.5 新增/更新 `packages/vfs/test/config.test.ts`：默认值、`-w`、`--workspace`、`VFS_WORKSPACE`、CLI 覆盖环境变量、`~` 展开、`source` 取值

## 2. App 工作区配置模块

- [x] 2.1 新增 `packages/app/src/workspace-config.ts`，实现平台相关的 launcher 配置路径（macOS / Linux / Windows）
- [x] 2.2 实现 launcher 配置读取：缺失、损坏或不可读时告警并按未配置处理
- [x] 2.3 实现 launcher 配置原子写入（临时文件 + rename），内容为 `{ version: 1, workspacePath }`
- [x] 2.4 实现 `resolveWorkspace(argv)`：`cli` ＞ `env` ＞ `config` ＞ `default`，仅在 `vfs` 返回 `default` 时读取 launcher 配置
- [x] 2.5 实现 `validateWorkspaceTarget(target, current)`：绝对路径、拒绝 `/` / home / 当前工作区及其内部路径、父目录存在且可写、拒绝非目录、空目录（忽略 `.DS_Store`）通过、含 `vfs.db` 通过、其他非空目录拒绝
- [x] 2.6 实现 macOS `/Volumes/<name>` 未挂载检测
- [x] 2.7 实现 `getWorkspaceInfo()`：返回 `path`、`defaultPath`、`source`、`pendingPath`（实时读取 launcher 配置，覆盖模式下不返回）
- [x] 2.8 定义启动失败错误类型与错误文案：包含路径、原因、来源、launcher 配置路径、三种恢复方式
- [x] 2.9 新增 `packages/app/test/workspace-config.test.ts` 覆盖优先级、读写、校验矩阵与 `pendingPath`

## 3. App 启动与 RPC

- [x] 3.1 改造 `packages/app/src/index.ts`：使用 `resolveWorkspace`，先校验再 `ensureWorkspace`，失败时打印错误并以非零码退出
- [x] 3.2 启动日志输出工作区路径与解析来源
- [x] 3.3 在 `packages/app/src/handlers.ts` 中覆盖 `getWorkspaceConfig`，返回增强结构
- [x] 3.4 在 `packages/app/src/handlers.ts` 中新增 `setWorkspacePath`：校验、写 launcher 配置、返回 `{ success, restartRequired, pendingPath }`
- [x] 3.5 在 CLI/env 覆盖模式下让 `setWorkspacePath` 拒绝更新并返回原因
- [x] 3.6 为 handler 注入工作区信息与写配置回调，便于单元测试
- [x] 3.7 新增/更新 app handler 测试：查询、保存成功、保存失败不写文件、覆盖模式拒绝

## 4. 扩展传输层

- [x] 4.1 在 `packages/extension/src/background/vfs-ws-client.ts` 中为 `getWorkspaceConfig` 定义增强返回类型
- [x] 4.2 新增 `setWorkspacePath(path)` 客户端方法
- [x] 4.3 保持现有 `getWorkspaceConfig` 调用方兼容（字段只增不改）

## 5. Options「存储与工作空间」卡片

- [x] 5.1 在 Settings 页新增「存储与工作空间」卡片：当前路径、来源、默认路径、待生效路径
- [x] 5.2 增加「复制路径」操作及复制成功反馈
- [x] 5.3 增加绝对路径输入框与保存按钮，通过 Background 转发至 app RPC
- [x] 5.4 根据 `source` 为 `cli` / `env` 时禁用编辑并显示覆盖说明
- [x] 5.5 保存成功后提示「重启后端后生效」并刷新 `pendingPath`
- [x] 5.6 保存失败时用 Ant Design `Alert` / `message.error` 展示服务端原因，不把失败值展示为已保存
- [x] 5.7 保存到全新空目录前弹出确认，警告 AI 配置回到默认、旧工作区数据与配置原地保留
- [x] 5.8 处理 app 未连接时的占位与刷新行为，避免卡片显示过期状态

## 6. 文档与验证

- [x] 6.1 更新 `README.md` 工作空间配置章节：优先级、Options 修改方式、重启生效、外置盘注意事项、启动失败恢复步骤
- [x] 6.2 更新 `ARCHITECTURE.md` 的 Workspace Configuration 决策
- [x] 6.3 运行 `pnpm lint`、`pnpm test`、`pnpm build`
- [x] 6.4 手动验证：无配置启动行为不变
- [x] 6.5 手动验证：Options 保存新空目录 → 提示待重启 → 重启后使用新路径且旧数据未被动过
- [x] 6.6 手动验证：指向已有工作区、非空非工作区、未挂载外置盘时的保存与启动行为
- [x] 6.7 手动验证：`VFS_WORKSPACE` 与 `--workspace` 覆盖时卡片只读且保存被拒绝
