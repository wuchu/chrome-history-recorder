## Why

当前视频抓取采用「CDP 识别 URL → offscreen 重新下载全量」的模型。用户已经完整浏览或缓冲过的内容并不会被直接使用，反而会产生第二次请求；对带签名、防盗链和风控的站点（如抖音）第二次请求经常 403 或拿到不完整结果。同时，现有逻辑把任意带 `Content-Range` 的 206 响应都当作候选，由下载器重新拉全量，这既不保证内容完整，也违背「只抓已经完整加载过的内容」这一产品原则。

## What Changes

- 新增**会话内缓冲视频组装**：在 debugger 会话中观察同一媒体资源的响应区间，只有当已提交区间的并集无洞覆盖 `[0, total)` 时才保存；存在任何空洞则整条丢弃。
- 引入**完整性门禁**：只有 `loadingFinished` 且实际 body 长度与 `Content-Range` 区间一致的响应才提交；`loadingFailed`、长度不符、total 不可知、body 不可取的响应一律不提交。
- **不补洞、不重试、不二次下载**：不完整即终态跳过，并在会话事件中给出缺失原因。
- 新增 app 侧 **assembly sink**：临时文件按字节偏移写入，完整后流式入库；配套一次性的本地 chunk 上传端点与 job token。
- 新增**按站点的 capture mode**：`buffer-only`（只接受完整缓冲）与 `re-download`（保留现有行为）。默认对抖音启用 `buffer-only`；机制本身通用，其他站点可逐步切换。
- **BREAKING**：`direct-video-download` 中「绝不读取页面自身响应体」的约定被撤销，改为 `re-download` 模式的行为；`buffer-only` 模式以会话内 body 为准。
- 会话事件与计数新增：组装进度、完整捕获、各类跳过原因（`playlist` / `in-memory` / `unknown-total` / `size-limit` / `incomplete` / `truncated` / `aborted` / `body-unavailable`）。
- 明确排除自适应流与内存媒体：`m3u8` / `mpd` / `ts` 段、`blob:` / MSE 不作为可组装资源。

## Capabilities

### New Capabilities

- `buffered-video-assembly`: 会话内媒体响应区间的记录、完整性判定、assembly job 生命周期、按偏移写入与最终入库。

### Modified Capabilities

- `video-capture`: 视频响应的分类语义从「创建下载候选」改为「登记组装区间」；206 响应不再默认触发重新下载；新增 playlist / MSE 排除。
- `direct-video-download`: 收窄为 `re-download` 模式的规范；撤销「绝不读取页面响应体」的绝对要求。
- `capture-session`: 新增组装进度事件、完整/不完整计数与跳过原因。
- `vfs-http-api`: 新增内部 assembly chunk 上传端点（token 保护、按偏移写入）。

## Impact

- `packages/extension`：`background/debugger-capture.ts`（响应分类、区间账本、body 读取）、`background/video-download.ts` 与 `entrypoints/offscreen`（按模式门控）、`background/capture-session-store.ts`（事件与计数）、`shared/extension-runtime.ts`（配置与类型）、Side Panel / Options UI。
- `packages/app`：assembly sink、job 生命周期、外部 RPC handler、事件广播。
- `packages/vfs`：HTTP chunk 端点；可选 `saveFileFromPath` 以避免 finalize 时二次拷贝。
- 配置：按站点的视频捕获模式；复用 `maxVideoSize` 作为总量上限。
- 测试：区间并集纯函数、完整性门禁、assembly 生命周期、chunk 端点安全与偏移写入。
- 不新增外部运行时依赖（继续使用 `ffmpeg-static`，且本变更不做转码/合并）。
