## Context

当前工作区路径在进程启动时一次性决定：

```
process.argv ──▶ parseArgs() ──▶ workspacePath ──┬─▶ SQLiteDatabase(workspace/vfs.db)
  --workspace / -w                               ├─▶ BlobStorage(workspace/blobs)
  默认 ~/.vfs-workspace                          ├─▶ ThumbnailStorage(workspace/thumbnails)
                                                 ├─▶ ConfigStore(workspace/config.json)
                                                 ├─▶ VFSAPI / WebSocket / HTTP
                                                 └─▶ 日志
```

关键约束：

- **App 配置住在工作区里**（`workspace/config.json`），因此"工作区路径"不能存进 App 配置，否则形成循环依赖。自定义路径只能存在工作区之外的用户级位置，或每次启动通过参数/环境变量传入。
- **后端进程不可由扩展重启**。扩展与 app 只有 WebSocket/HTTP 连接，没有进程管理能力，因此路径变更只能"下次启动生效"。
- **Chrome 扩展没有原生文件夹选择器**，Options UI 只能提供文本输入 + 服务端校验。
- 两个入口都解析参数：[vfs/src/index.ts](packages/vfs/src/index.ts)（独立存储服务）与 [app/src/index.ts](packages/app/src/index.ts)（产品运行时）。默认路径在 [vfs/src/config.ts](packages/vfs/src/config.ts) 与 [vfs/src/sqlite.ts](packages/vfs/src/sqlite.ts) 各有一份实现。
- 扩展侧已有 `getWorkspaceConfig()` 客户端方法但无 UI 消费；vfs 的 `setWorkspaceConfig` 是明确的"初始化后不可修改"桩。

## Goals / Non-Goals

**Goals:**

- 用户在 Options「设置 → 存储与工作空间」中查看并修改工作区路径，重启后端后生效。
- 路径解析优先级明确且可解释：`--workspace` / `-w` ＞ `VFS_WORKSPACE` ＞ 用户级 launcher 配置 ＞ `~/.vfs-workspace`。
- 保存前校验目标路径，拒绝会污染用户目录或制造"数据消失"错觉的目标。
- 切换路径不移动、不复制、不删除旧工作区数据。
- 启动时目标不可用时失败退出，并给出可执行的恢复指引。
- 未配置自定义路径时，行为与当前完全一致。

**Non-Goals:**

- 不做数据迁移/复制/自动搬迁（SQLite WAL 在 db 打开时复制不安全，且目录可能很大）。
- 不做运行期热切换（需要重建 db、storage、API、WS、HTTP、scheduler，并处理扩展重连与在途任务）。
- 不做多工作区（profiles）与工作区注册表。
- 不实现原生目录选择器（需要桌面壳）。
- 不把端口配置并入 launcher 配置（保持 `VFS_WS_PORT` / `VFS_HTTP_PORT` 现状）。
- 不自动重启后端。

## Decisions

### Decision 1: 用户级 launcher 配置文件位于工作区之外

使用平台约定的用户配置目录：

```
macOS    ~/Library/Application Support/browser-media-recorder/config.json
Linux    $XDG_CONFIG_HOME/browser-media-recorder/config.json
         缺省 ~/.config/browser-media-recorder/config.json
Windows  %APPDATA%\browser-media-recorder\config.json
```

内容：

```json
{ "version": 1, "workspacePath": "/absolute/path/to/workspace" }
```

- 写入使用"临时文件 + rename"的原子替换，目录按需创建。
- 读取失败（损坏、权限）时记录警告并视为未配置，继续走默认路径，不阻塞启动。
- 只保存工作区路径，不保存 AI/捕获配置——那些仍由 `workspace/config.json` 持有。

**Alternatives considered:**

- 存在 `workspace/config.json`：循环依赖，打开工作区前读不到，排除。
- 存在扩展 `chrome.storage`：app 启动不读扩展存储，且会颠倒"app 为配置真源"的关系，排除。
- 工作区根目录放指针文件（如 `~/.vfs-workspace/.workspace-path`）：用户切到全新的家目录/外置盘后指针本身不见了，语义混乱，排除。

### Decision 2: 解析优先级与来源标注

```
--workspace / -w      source: 'cli'
VFS_WORKSPACE         source: 'env'
launcher config       source: 'config'
默认 ~/.vfs-workspace source: 'default'
```

- `vfs` 包只负责 CLI + 环境变量（独立 `vfs` 入口沿用），`parseArgs` 返回值增加 `source` 字段。
- app 在 `vfs` 的解析结果之上补一层：仅当 `source === 'default'` 时读取 launcher 配置；否则 CLI/env 覆盖，launcher 配置被忽略但保留在磁盘上。
- 被 CLI/env 覆盖时，Options 卡片**只读**并显示"由启动参数/环境变量指定，修改 Options 不会生效"。

**Alternatives considered:**

- app 自己重新解析参数：与 vfs 重复实现，排除。
- launcher 配置优先于 CLI/env：会制造"明明传了参数却没生效"的困惑，排除。

### Decision 3: `getWorkspaceConfig` 由 app 覆盖为增强响应

vfs 的存储分发器先调用 app 的外部 handler，返回 `undefined` 才落入存储方法表。app 覆盖 `getWorkspaceConfig`：

```ts
{
  path: string;                 // 当前进程实际使用
  defaultPath: string;          // ~/.vfs-workspace
  source: 'cli' | 'env' | 'config' | 'default';
  pendingPath?: string;         // 读取 launcher 配置后，与 path 不同的路径
}
```

- `pendingPath` 在每次调用时现场读取 launcher 配置，不做文件监听；用户手工改配置也能被 UI 察觉。
- 当 `source` 为 `cli` / `env` 时不返回 `pendingPath`（配置不会生效，避免误导）。
- vfs 独立入口的 `getWorkspaceConfig` 仍返回 `{ path }`，保持存储层语义不变。

### Decision 4: 新增 `setWorkspacePath`，保留旧 `setWorkspaceConfig` 的拒绝行为

- 新增 app 级 RPC `setWorkspacePath({ path })`：
  - 校验通过 → 原子写入 launcher 配置 → 返回 `{ success: true, restartRequired: true, pendingPath }`。
  - 校验失败 → 抛出带具体原因的错误，经分发器包装为 `{ success: false, error }`，不写任何文件。
- 不修改 vfs 的 `setWorkspaceConfig` 桩，其"初始化后不可修改"语义对独立存储服务仍然成立；现有测试无需改写。

**Alternatives considered:**

- 复用 `setWorkspaceConfig` 并改变语义：会让独立 vfs 入口与 app 行为分叉，且破坏现有测试契约，排除。

### Decision 5: 保存时与启动时各校验一次

保存时校验（快速失败、错误直接呈现在 Options）：

1. 去空白后必须为非空绝对路径；支持 `~` 展开；相对路径拒绝。
2. 拒绝：`/`、home 目录本身、当前工作区、当前工作区内部路径（含 `blobs/`、`thumbnails/`、`.tmp/`）。
3. 父目录必须存在且可写；目标不存在时只创建目标本身，不递归创建父链。
4. 目标存在时必须是目录；空目录（忽略 `.DS_Store`）→ 允许新建；含 `vfs.db` → 允许采用；其他非空目录 → 拒绝。
5. macOS 防护：路径位于 `/Volumes/<name>/...` 且 `/Volumes/<name>` 不存在时，报"外置卷未挂载"，而不是在挂载点创建空目录。

启动时再次校验（防止保存后环境变化）：

1. 解析出路径后，父目录缺失/不可写 → 报错退出。
2. 目标已存在且非空但无 `vfs.db` → 报"不是工作区"退出。
3. 目标不存在且父目录可写 → 创建新工作区。
4. 打开 SQLite 失败 → 报错退出。

**Alternatives considered:**

- 只在启动时校验：用户保存成功、重启后才失败，且失败后扩展无法连接到设置页，体验差，排除。
- 只在保存时校验：外置盘可能被拔掉，启动仍需要兜底，排除。
- 用 marker 文件识别工作区：现有工作区没有 marker，需要兼容逻辑；以 `vfs.db` 存在性判断更简单且向后兼容，采用后者。
- 保存时打开 SQLite 做 schema 探测：可能加锁或创建文件，代价大于收益，排除；损坏的库由启动时打开失败兜底。

### Decision 6: 启动失败采用 fail-fast，不回退

启动失败时进程打印以下信息后退出（非零退出码）：

```
无法使用配置的工作区：/Volumes/SSD/vfs-workspace
原因：外置卷 /Volumes/SSD 未挂载
配置来源：launcher config (~/Library/Application Support/browser-media-recorder/config.json)
恢复方式：
  1. 挂载对应磁盘后重新启动
  2. 或使用 --workspace <path> 临时指定其他工作区
  3. 或删除上述配置文件的 workspacePath 字段以回到默认 ~/.vfs-workspace
```

- 不回退到默认路径或"上次可用路径"：自动回退会让新捕获写入用户预期之外的位置，甚至制造"数据丢了"的错觉。
- 恢复依赖命令行/文件编辑，这是当前"后端由用户自己启动"阶段可接受的代价；未来若有桌面启动器，可在启动器中提供同样的恢复界面。

**Alternatives considered:**

- 回退到 `~/.vfs-workspace`：最危险，用户可能以为数据丢失，排除。
- 记住 last-known-good 并回退：需要额外的状态与 UI 告警，v1 不做。
- 降级为"只起 WS 供修复"的模式：架构改动过大，v1 不做。

### Decision 7: 数据安全与配置随工作区走

- 切换路径只写 launcher 配置，不触碰旧工作区；旧工作区中的 `vfs.db`、`blobs/`、`thumbnails/`、`config.json` 全部原地保留。
- 新目标为空时按默认配置初始化（`classificationPaused: true`），意味着 Ollama 地址、模型、语言等回到默认值；UI 在保存前明确警告"AI 配置不会随路径迁移；旧工作区的配置保留，切回即可恢复"。
- 采用已有工作区时，该工作区的 `config.json` 直接生效，扩展在连接后从 app 拉取镜像配置。

### Decision 8: Options UI 形态

在 Settings 页新增「存储与工作空间」卡片（Ant Design Card + Form）：

```
当前路径   /Users/x/.vfs-workspace            [复制]
来源       默认值 / launcher 配置 / 启动参数 / 环境变量
默认路径   ~/.vfs-workspace
待生效     /Volumes/SSD/vfs-workspace          （仅 pendingPath 存在时显示）

[ 绝对路径输入框                          ] [保存]

提示：修改后需要重启后端进程才会切换；当前仍写入 /Users/x/.vfs-workspace。
```

- `source` 为 `cli` / `env` 时输入框与保存按钮禁用，附说明。
- 保存成功使用 Ant Design `message` 提示"已保存，重启后端后生效"，并刷新 `pendingPath`；保存失败用 `Alert` / `message.error` 展示服务端错误（如"目标目录非空且不是工作区"）。
- 目标是空目录时，保存前附加二次确认，说明 AI 配置将回到默认值。
- 不做目录浏览按钮；提供"复制路径"方便用户在 Finder 中定位。

### Decision 9: 代码归属与共享

- 路径解析（CLI + env）留在 [vfs/src/config.ts](packages/vfs/src/config.ts)，`vfs/src/sqlite.ts` 删除重复的 `getDefaultWorkspacePath`，改为从配置模块导入/重导出。
- launcher 配置读写、优先级合成、目标校验、错误类型放在 `packages/app/src/workspace-config.ts`；不放进 vfs，因为它属于产品级启动策略，独立 vfs 入口不应读取产品配置。
- `app/src/handlers.ts` 通过依赖注入接收工作区信息与写配置回调，便于单元测试。
- 扩展类型定义放入 `shared/extension-runtime` 或 ws client 导出的类型，避免在多个组件重复声明。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 保存时外置盘在、重启时不在 → 后端起不来，扩展无法修复 | fail-fast + 明确错误（配置路径、原因、`--workspace` 恢复方式）；README 记录恢复步骤 |
| 用户误选家目录/根目录 → `vfs.db` 污染用户目录 | 拒绝非空且无 `vfs.db` 的目录；显式拒绝 `/`、home、当前工作区及其内部路径 |
| 外置盘未挂载时在挂载点静默创建空工作区 | 保存与启动均检查 `/Volumes/<name>` 是否存在；父目录必须存在 |
| 新工作区导致 AI 配置"丢失"的错觉 | UI 保存前警告；旧工作区配置原地保留，切回即恢复 |
| macOS `.DS_Store` 使空目录判定失败 | 判定空目录时忽略 `.DS_Store` |
| launcher 配置被手工改坏 | 读取失败仅告警并按未配置处理；写入采用原子替换 |
| 两个 app 实例指向不同工作区 | 端口冲突会阻止第二个实例启动，v1 不额外处理 |
| CLI/env 覆盖时用户误以为保存生效 | 卡片只读并说明覆盖来源 |

## Migration Plan

1. 上线后默认行为不变（无 launcher 配置时仍使用 `~/.vfs-workspace`）。
2. 已使用 `--workspace` 的用户：CLI 继续优先，无需任何操作。
3. 用户首次在 Options 保存路径即创建 launcher 配置文件；旧工作区数据保持原样。
4. 回滚：删除 launcher 配置文件（或其中 `workspacePath`）即回到默认路径；代码回滚后该文件会被忽略，不影响数据。

## Open Questions

- 无。范围与行为已确认：Options 可改、重启生效、旧数据保留原地、启动不可用则失败退出。
