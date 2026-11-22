## Context

当前视频链路是：CDP `Network.responseReceived` 判断 `video/*` → 记录 URL 候选 → `VideoDownloadManager` 排队 → offscreen 以 `credentials: 'omit'` 重新请求该 URL → 流式 `POST /upload`。对应规范 [video-capture](../../specs/video-capture/spec.md) 与 [direct-video-download](../../specs/direct-video-download/spec.md)，后者明确要求「不读取页面自身媒体请求的响应体」。

这条链路在抖音这类站点上有三个问题：

1. 媒体 URL 带签名、防盗链和风控，二次请求容易 403 或拿到不同的内容；offscreen 还没有正确的 `Referer` / cookie / UA。
2. 视频被浏览器拆成多个 `206` 区间时，重新下载整文件既产生重复流量，也不符合「抓取我已经完整浏览/缓冲过的内容」的产品原则。
3. 现有实现把任何带 `Content-Range` 的 206 都当作候选，不区分「完整资源」与「片段」。

本变更把判断标准从「是不是视频资源」改为「**是否已经完整覆盖整个资源**」：只接受会话中观察到的、无洞覆盖 `[0, total)` 的字节。接受多段 Range，但绝不补洞、不重试、不二次下载。

关键约束：

- 扩展读不到 Chrome 的媒体缓存，只能在 debugger 会话期间拿到响应体；事后无法补抓。
- MV3 service worker 不适合持有大块字节，字节必须尽快转交给 app。
- 自适应流（MSE / `blob:`）的每个 segment 是独立资源，Range 覆盖模型不适用。
- 现有 `tasks` 表以 `target_hash` 为键，只能表达「文件入库后的 AI 任务」；组装中的视频需要独立的临时状态。

## Goals / Non-Goals

**Goals:**

- 在 debugger 会话中记录同一媒体资源的响应区间，只在并集无洞覆盖 `[0, total)` 时保存。
- 支持单个 200、单个覆盖全文件的 206、以及多段 206（乱序、重叠、相邻均可）。
- 完整时自动入库并复用现有 ingest hook（`file:captured` + classify/rename）。
- 不完整时整条丢弃，并在会话事件中给出可解释的跳过原因。
- 通用机制与站点策略分离：`buffer-only` 可按站点启用，后续可全局默认。
- 大文件不经过 service worker 内存组装。

**Non-Goals:**

- 不做缺口补齐、重试、二次下载、断点续传。
- 不解析 HLS/DASH 播放列表，不处理 MSE segment。
- 不做音视频分离流的合并（YouTube 场景不在本变更范围）。
- 不读取或写入 Chrome HTTP cache。
- 不改 AI 分类/重命名逻辑。
- 不新增外部运行时依赖。

## Decisions

### 1. 完整性门禁是唯一准入条件

每个资源维护一个区间账本，提交条件为：

- `loadingFinished` 且实际 body 字节数等于该响应声明的区间长度；
- 区间来自 `Content-Range`（206）或 `Content-Length`（200）；
- 所有已提交区间的并集覆盖 `[0, total-1]`，且 total 在会话内保持一致。

只要 `loadingFailed`、长度不符、total 变化、body 取不到，该区间就不提交；最终仍有洞则整条丢弃。

**为什么不用「任意片段先存，后面再补」**：用户明确要求片段视为未抓取；补洞会重新引入二次请求与 URL 失效问题，也破坏「只抓已完成浏览内容」的语义。

### 2. 资源身份与 total

- 资源键：`tabId + 最终 response.url`。Range 通过请求头传递，不改变 URL；重定向使用最终 `response.url`。
- total：206 取 `Content-Range` 的 `/T`；200 取 `Content-Length`；都缺失则不建 job。
- 同一资源键在会话内出现不同的 total → 视为冲突，丢弃并记 `total-mismatch`。
- 已知限制：若 CDN 为不同区间轮换不同签名 URL，会被当成多个资源，覆盖不成立 → 记 `incomplete`。抖音实测若出现该情况，再引入页面级 `currentSrc` 归一化。

**备选**：按页面 `aweme_id` 聚合。暂不采用，避免把页面语义耦合进通用机制。

### 3. Body 读取：默认 `getResponseBody`，大区间走 `streamResourceContent`

- `loadingFinished` 后调用 `Network.getResponseBody`，这是现有图片路径已验证的能力。
- `responseReceived` 时若声明区间长度超过 `ASSEMBLY_INLINE_BODY_LIMIT`（初值 32 MiB），改为在该请求上启用 `Network.streamResourceContent`，先处理返回的 `bufferedData`，再消费带 `data` 的 `Network.dataReceived`，按累计偏移分块写入。
- 同一 tab 同时只允许一个 body 读取任务，避免内存峰值叠加。
- 单段超过 `maxVideoSize` 直接跳过。

**为什么不在 `loadingFinished` 才决定流式**：`streamResourceContent` 必须在数据被消费前开启；大段等到结束后再取会受 Network buffer 与内存限制。

### 4. 字节交给 app 侧 assembly sink，不在 SW 组装

新增 VFS HTTP 内部端点（不经过 WS base64）：

```
POST /assemblies                     → { jobId, token }      建 job（total/mime/sourceUrl/pageUrl）
PUT  /assemblies/:jobId/chunks?offset=N  (application/octet-stream, X-Assembly-Token) → 204
POST /assemblies/:jobId/complete     (X-Assembly-Token)       → { hash, duplicate, size, mimeType }
DELETE /assemblies/:jobId            (X-Assembly-Token)       → 204
```

- sink 在每次写入时记录区间，**服务端独立校验最终覆盖**；扩展的本地账本只用于 UI 和跳过判定，finalize 以服务端为准。
- 临时文件位于 `workspace/tmp/assemblies/{jobId}.part`，按 offset 写入；finalize 时用 `createReadStream` 交给 `saveFileFromStream`，由现有 ingest hook 完成入库和任务入队。
- 每个 job 设置 `maxBytes`（取配置 `maxVideoSize` 与服务端上限的较小值）、30 分钟不活动 TTL、并发上限（初值 4）；启动时清理过期临时文件。
- 端点安全：一次性 token（建 job 时生成）、`Content-Type: application/octet-stream`（网页发起会触发 preflight 而被 CORS 阻挡）、校验 `offset + len <= total`、只监听 localhost。

**备选 A：全部攒在 SW 内再 `POST /upload`** —— 大文件内存不可控，且 SW 可能被回收。
**备选 B：WS 传 base64** —— 体积 +33%，需要改协议与分片，无收益。

### 5. 账本位置与生命周期

- 扩展侧账本保存在 service worker 内存，并把 `{jobId, total, ranges, skipped}` 快照写入 `chrome.storage.session`，与现有 capture session 快照同生命周期。
- 字节不落扩展；`loadingFinished` 后立即 PUT 到 app。
- 覆盖完成时立即 finalize（不等待用户操作）；会话停止时对未完成 job 调 `DELETE` 并记录 `incomplete`。
- service worker 重启后 debugger 会话通常已断开，未完成 job 视为失败并清理；已完整但未 finalize 的 job 允许在恢复时补一次 `complete`。

**为什么自动 finalize**：完整缓冲即代表用户已经加载过整条视频；等待用户操作只会增加临时文件驻留时间和丢失风险。

### 6. 通用机制 + 按站点模式

新增配置：

```ts
type VideoCaptureMode = 'buffer-only' | 're-download';

videoCaptureMode: VideoCaptureMode;                    // 全局默认，初值 're-download'
videoCaptureModeByHost: Record<string, VideoCaptureMode>; // 后缀匹配
```

- 机制本身与站点无关，任何 progressive 资源都可进入完整性门禁。
- 初始策略：`douyin.com`、`douyinvod.com`、`v.douyin.com` → `buffer-only`；其余保持 `re-download`。
- 验证稳定后可把全局默认切到 `buffer-only`，只需改配置，不改代码；回滚同理。
- `re-download` 路径沿用现有 `VideoDownloadManager` / offscreen，不在本变更中删除。

### 7. MSE / 播放列表识别

- `m3u8` / `mpd` 的 MIME（`application/vnd.apple.mpegurl`、`application/x-mpegurl`、`application/dash+xml`）直接跳过，记 `playlist`。
- `blob:` / `data:` 跳过，记 `in-memory`。
- 对 `buffer-only` 的站点，在开始组装前（或首次视频响应时）用 `chrome.scripting.executeScript` 读取页面 `<video>` 的 `currentSrc`：
  - 全部为 `blob:` → 判定为 MSE，跳过 `in-memory`；
  - 存在与媒体 URL 同源同路径的 `currentSrc` → 视为 progressive，允许组装；
  - 无法判断 → 保守跳过 `unverified-source`（可通过配置放宽）。
- `video/iso.segment`、`video/mp2t`、`.m4s` / `.ts` 路径同样跳过，避免把单个 segment 当成完整视频。

### 8. 跳过原因与观测

统一原因枚举：`playlist`、`in-memory`、`unverified-source`、`unknown-total`、`total-mismatch`、`size-limit`、`truncated`、`aborted`、`body-unavailable`、`incomplete`、`capacity`。

- `video:assembling`：`{ url, receivedBytes, totalBytes }`（节流广播）。
- `video:complete`：`{ hash, size, mimeType, duplicate }`。
- `video:skipped`：`{ url, reason, missingBytes? }`。
- 会话计数新增：`videosAssembling`、`videosComplete`、`videosSkippedIncomplete`；`re-download` 模式继续使用现有计数。
- 跳过计入 `skipped`，不重试。

### 9. 入库与去重

- finalize 走 `api.saveFileFromStream`，沿用 SHA-256 内容哈希；重复内容返回 `duplicate`，不重复广播 `file:captured`。
- MIME 以响应头为准，必须仍在 `enabledVideoTypes` 内；`sourceUrl` 使用媒体 URL，`pageUrl` 单独记录到会话事件。
- 可选优化：新增 `saveFileFromPath` 直接移动临时文件并按流哈希，避免当前 finalize 的二次拷贝（列入开放问题）。

## Risks / Trade-offs

- **完整覆盖命中率低** → 某些站点几乎不会出现无洞覆盖。缓解：先只在抖音启用，保留 `re-download`；实测后再扩大范围；UI 明确提示「开始捕获后未完整加载」。
- **大区间内存/传输压力** → 使用 `streamResourceContent` + 32 MiB 阈值 + `maxVideoSize`；同一 tab 串行读取 body。
- **SW 生命周期** → 字节即时转交 app；账本写 `chrome.storage.session`；重启后未完成 job 清理并记录原因。
- **MSE 误判** → `currentSrc` 探针 + segment MIME/路径排除；无法判断时保守跳过，宁可少抓不可错抓。
- **多签名 URL 导致覆盖不成立** → 记为 `incomplete`；必要时再引入页面级归一化键。
- **`loadingFailed` 但字节其实已到齐** → 严格拒绝，避免把不可验证的内容入库；这是有意的质量取舍。
- **本地写盘端点的 CSRF 面** → 一次性 token + 非简单 Content-Type + offset 边界校验 + localhost 绑定；同时评估现有 `/upload` 的同类风险。
- **配置复杂度** → 提供主机后缀表而不是逐 URL 规则；默认值保证旧行为可回滚。

## Migration Plan

1. 新增配置字段并提供默认值：全局 `re-download`，抖音主机覆盖为 `buffer-only`。旧配置加载时补齐，无需数据库迁移。
2. 先落地区间并集纯函数、服务端 sink 与完整性校验，再接入 CDP body 读取。
3. 在抖音上实测并调整探针与阈值；确认稳定后，再把全局默认切为 `buffer-only`。
4. 回滚：把对应主机的 `videoCaptureModeByHost` 改回 `re-download`，现有下载链路立即恢复；未完成的 assembly job 由 TTL 清理。

## Open Questions

- 抖音当前是否全程使用 progressive `<video src>`；完整播放后区间并集是否真的无洞（需要 spike）。
- `chrome.debugger` 下的 `Network.streamResourceContent` 是否稳定、`dataReceived.data` 的累计偏移语义是否与 `bufferedData` 无缝衔接。
- 缓存命中的响应能否通过 `getResponseBody` 取到 body（影响重复观看时的可用性）。
- 是否需要 `saveFileFromPath` 以避免 finalize 的二次拷贝。
- 全局切换 `buffer-only` 的判定标准（按站点覆盖率还是按用户配置）。

## Verification

2026-11-22：在真实抖音会话中完成 tasks 1.1–1.5 与 10.1–10.4 的验证；`buffer-only` 的 progressive 假设、完整播放后的无洞覆盖、以及不完整资源丢弃行为均按本设计工作。若抖音后续改为 MSE 或调整 Range 行为，重新执行这些检查并按需调整探针与阈值。
