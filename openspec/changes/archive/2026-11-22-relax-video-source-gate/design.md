## Context

`buffer-only` 模式在创建 assembly job 前要求「页面 `<video>` 能证明这个媒体 URL 是 progressive 来源」。当前实现（[video-source-probe.ts](../../../packages/extension/src/background/video-source-probe.ts)、[video-assembly-controller.ts](../../../packages/extension/src/background/video-assembly-controller.ts)）有三处过严：

1. 探针只查顶层文档的 `document.querySelectorAll('video')`，不穿透 shadow DOM、不查 iframe，且只读 `currentSrc`；
2. 匹配要求 `origin + pathname` 完全相等，CDN host 轮换或重新签名都会失败；
3. 探针结果缓存 3 秒，`unverified-source` 又以 URL 为键永久记录在 `skippedReasons` 中，一次失败就把整条资源判死。

已观察到的失败样例：

```
mime_type=video_mp4&br=3792&__vid=7710926097772479141
https://v95-web-sz.douyinvod.com/.../video/tos/.../o8ETaIsE...
事件：video:skipped / unverified-source
```

这条 URL 的形态不像 `.m4s` / `.ts` 分片，且很可能带有 `Content-Range`；问题更可能是来源验证假阴性，而不是媒体不可取。

本设计同时覆盖两种可能的页面现实：

```
形态 A：响应是 206 / 多次 Range 的 progressive 资源
        页面 <video> 在 shadow DOM、iframe 中，或 currentSrc 为空/是别的 host
        → 网络形状本身就足够证明可取

形态 B：响应是 200 整包，播放器仍把同一个 MP4 喂给 MSE
        页面 currentSrc 是 blob:，或没有可用的 http source
        → 需要更强的来源标识（__vid / 路径尾段 / 多 Range 重复）
```

无论 A 还是 B，都不改变区间账本、完整性门禁、不重试断层和「不重新下载完整文件」这些既有语义；补洞默认开启，但只针对缺失区间。

## Goals / Non-Goals

**Goals:**

- 消除对合法 progressive / range-shaped 资源的来源假阴性。
- 在 206 + `Content-Range` 这类强证据下，不再依赖 `<video>` 探针。
- 用分层证据替代「origin + path 完全相等」，兼容 host 轮换和 shadow DOM / iframe 播放器。
- 让 `unverified-source` 可重试，不再一次探针失败就永久拉黑。
- 保留对 playlist、segment、真 MSE 的防误收。
- 让下一次类似问题可以从事件日志直接看出「哪一层证据缺失」。

**Non-Goals:**

- 不采集真正的 MSE 分片字节；不引入 `SourceBuffer.appendBuffer` 拦截。
- 不引入 `MediaRecorder` / `captureStream` 录制。
- 不引入页面 JSON（`play_addr`）或 yt-dlp 兜底下载。
- 不改变 `re-download` 模式，不改变 VFS/app 接口。
- 不改变「不完整就整条丢弃」的最终语义。

## Decisions

### 1. 用分层证据替代单一探针

| 强度 | 证据 | 动作 |
|---|---|---|
| 强 | `206` + 可解析 `Content-Range` | 直接开 job，不探针 |
| 强 | 同一 URL 观察到 ≥2 个不同 Range，total 一致 | 直接开 job |
| 强 | 任意 video source 与媒体 URL `origin + pathname` 完全相同 | 开 job |
| 中 | 媒体 URL 与 source 共享稳定标识（`__vid`、`aweme_id`、长路径尾段） | 开 job |
| 中 | 媒体 URL 与 source 的 pathname 相同、host 不同 | 开 job |
| 弱 | `200` 整包，且没有任何 source 证据 | 跳过本次响应，等待重试 |
| 否决 | playlist / segment MIME 或路径、全部 source 为 blob 且无 Range 证据 | 终态跳过 |

证据判定顺序固定，先强后弱；一旦命中强/中证据就放行。

### 2. 206 优先，不依赖 `currentSrc`

`206 + Content-Range` 本身就是「字节区间媒体」的强信号；抖音/大多数 CDN 的独立分片通常以 200 整包返回，而不是对同一资源反复返回 206。因此：

- 206 直接进入区间账本；
- 200 才需要来源匹配或稳定标识。

**备选**：所有响应都先探针。已否决——这正是当前假阴性的来源，且对 shadow DOM / iframe / 懒挂载不可靠。

### 3. 来源匹配阶梯

```
exactUrlMatch(media, source)          // origin + pathname 全等
  → stableIdMatch(media, source)      // __vid / aweme_id / 路径尾段（≥16 字符）
  → hostInsensitivePathMatch(media, source)
  → no evidence
```

- `blob:` / `data:` 永远不参与匹配。
- 路径尾段只在前两级失败后使用，且长度至少 16 字符，降低碰撞概率。
- 稳定标识优先从 query 的 `__vid` 提取；其次从页面 URL `/video/<id>` 提取 `aweme_id`；都不存在时用 pathname 的最后一段。

**备选**：只放宽到 host-insensitive path。不够——CDN 重新签名时 path 前缀也会变化，只有路径尾段/`__vid` 稳定。

### 4. 探针增强与非终态缓存

`probeVideoSources` 改为：

- `chrome.scripting.executeScript({ allFrames: true, func })`，收集所有 frame 的结果；
- 在注入函数内递归 shadow root（`element.shadowRoot`）查找 `<video>`；
- 同时读取 `src` 与 `currentSrc`，并记录 `srcObject` 是否存在（用于区分 MSE）；
- 单 frame 失败不影响其他 frame，整体失败返回 `unverified` 而不是抛错；
- 缓存策略：
  - `progressive` / `mse` 结果缓存 3 秒；
  - `unverified` 结果只缓存很短（例如 500ms），且不写入永久跳过表。

### 5. `unverified-source` 可重试

把「URL → 终态跳过原因」拆成两类：

```
permanentSkips: playlist / in-memory / size-limit / total-mismatch
unverifiedAttempts: Map<resourceKey, { count, firstAt, lastAt }>
```

- `unverified-source` 只跳过当前响应，不创建 job，也不立即发终态 skip 事件；
- 后续 Range 到达时重新探针（受探针短缓存约束）；
- 同一资源累计 3 次仍无证据，或超过 10 秒仍无证据，才发 `video:skipped(unverified-source)` 并写入 permanent；
- 导航、会话停止、debugger detach 时清空计数；
- 字节区间一旦进入 job，不会为了完整性重新下载整个文件；补洞只在开启时针对缺失区间。

### 6. 诊断信息

`video:skipped` 事件增加可选 `detail` 字段（有长度上限，不包含完整签名 query）：

```ts
detail: 'status=206 range=0-1048575/52428800 evidence=none probe=unverified sources=0'
```

用于回答「为什么这条没抓」：

- 响应状态、是否带 `Content-Range`；
- 探针状态（progressive / mse / unverified）、source 数量；
- 最终采用的匹配策略（exact / stable-id / path / none）；
- 重试次数。

Side Panel 的 `video:skipped` 文案从「视频未完整」改为「视频已跳过」，具体原因仍由 `reason`（如「无法确认是渐进式来源」）描述，避免暗示字节缺失。

### 7. 防误收护栏

- playlist / `.m4s` / `.ts` / `video/iso.segment` / `video/mp2t` 仍然终态跳过。
- 全部 source 为 `blob:` 且没有 206/Range 证据 → `in-memory` 终态跳过。
- 200 整包进入 job 前，仍要求 `total >= MIN_VIDEO_SIZE` 且在 `maxVideoSize` 内。
- 若同一页面在短时间内出现多个互不相同的 200 媒体 URL，且每个都小于阈值，视为分片形态，不因 `mime_type=video_mp4` 放宽。
- `__vid` / 路径尾段匹配只用于「允许组装」，不改变区间完整性判定。

### 8. 页面聚焦过滤与容量预占

抖音搜索页会同时存在主视频、相关推荐和信息流预加载，且它们可能都是 206 progressive 资源。若全部进入组装，默认 4 个并发槽位会被背景视频占满，主视频反而收到 429 capacity。因此：

- 当页面 URL 暴露稳定媒体标识（`modal_id` / `aweme_id` / `/video/<id>`）时，只有 `__vid` 与页面标识一致的媒体可以创建 job；背景媒体静默忽略，不产生跳过事件。
- 每次主视频响应到达时，先中止同 tab 下不匹配页面标识的活跃 job，释放槽位，再创建主视频 job。
- 页面标识或媒体 `__vid` 任一缺失时，退回原有证据规则，不做过滤。
- `AssemblyManager` 默认并发从 4 提升到 8；达到上限时扩展侧只延迟、不永久拉黑，后续响应可以重试。

**备选**：无限提高并发。会带来临时文件与内存压力，也没有解决背景视频抢占槽位的根因，因此不采用。

### 9. 缺失头部提示与可选补洞

浏览器在捕获开始前已经缓冲的字节不会再发网络请求，CDP 也读不到媒体缓存；这是无法通过重播解决的问题。因此：

- 第一个观察到的区间起点大于 0 时，在 `video:assembling` 事件中写入 `detail=hint=reload-page missing-head=<bytes>`；UI 显示「该视频在开始捕获前已缓冲，请刷新页面后重播」。
- 新增 `videoAssemblyFillGaps`，默认 `true`。关闭时保持「不补洞、不二次下载」。
- 开启后，扩展在写入暂停 1.5 秒后计算 `missingRanges(intervals, total)`，只对空洞发起 Range 请求；已知的头部空洞在 job 创建时立即补，不等待防抖；取消会话时最多等待 3 秒让在途补洞完成：
  - 通过 `chrome.scripting.executeScript` 在页面上下文执行 `fetch(url, { Range, credentials: 'omit' })`，天然携带页面 Referer；签名 URL 不需要 cookie，`include` 会在 CDN 返回通配符 CORS 头时触发 CORS 失败；同时对同一 `__vid` 的候选 URL 逐个重试；
  - 按 1 MiB 分块返回 base64，再写入 assembly job 的对应 offset；
  - 每个 job 最多尝试 3 轮，失败只记录 `fill-gaps=failed`，不会无限重试，也不会下载完整文件；
  - 页面上仍有播放器请求同一区间时，重复写入是幂等的。

**备选**：在 background 直接 `fetch`。会丢失页面 Referer/cookie，签名 URL 容易 403，因此不采用。

## Risks / Trade-offs

- **真 MSE 分片以 206 返回，被误当 progressive** → 用 segment MIME/路径、最小尺寸、total 一致性、以及「分片通常是不同 URL」共同约束；若实测仍误收，再对 206 增加「同一 URL 至少两次 Range」的门槛。
- **`allFrames` + shadow DOM 探针变慢** → 探针只在需要时执行；单 frame 超时/失败隔离；命中 206 强证据时完全不执行。
- **重试导致终态延迟** → 3 次 / 10 秒上限；用户仍能在事件日志看到最终结果；不阻塞其他资源。
- **路径尾段/`__vid` 碰撞** → 只在前两级失败后使用，尾段长度 ≥16 字符；精确 URL 匹配仍优先。
- **诊断 `detail` 泄露签名参数** → 只记录状态、total、策略、数量，不记录完整 query。
- **放宽后抓取率上升，可能带来更多无效 assembly job** → job 仍受服务端容量、大小上限和覆盖校验约束；不完整即删除。
- **页面聚焦过滤会忽略背景信息流视频** → 只在页面 URL 暴露稳定媒体标识时启用；没有 `modal_id` / `aweme_id` 的页面仍按原有证据规则处理。用户关闭弹窗或离开聚焦页后，背景视频可重新进入捕获。
- **容量预占会中止背景 job** → 只中止与当前页面标识不一致的 job；主视频 job 不受影响；被中止的临时文件由服务端删除。
- **补洞会重新发起网络请求** → 默认开启，可在 Options 关闭；只补缺失区间，按 1 MiB 分块、最多 3 轮；失败不回退为完整重下。
- **页面上下文 fetch 可能被签名过期或风控拒绝** → 按同一 `__vid` 尝试页面已出现过的其他签名 URL；失败只记录 detail，不影响已捕获区间；关闭补洞时行为与原来一致。
- **大量 `video:assembling` 事件** → 进度仍按节流发送；缺失头部提示每个 job 只发一次。
- **完全没有观察到任何区间时无法补洞** → 补洞需要一个已知的 job（URL 与 total）。如果视频在捕获前已经完整缓冲且页面不再发请求，扩展无从得知该资源；仍需要在捕获开启状态下刷新页面后重播。

## Migration Plan

- 无配置、数据库或 API 迁移；改动全部在 extension 内部。
- 先在抖音默认的 `buffer-only` 路径观察 `unverified-source` 事件数量和误收情况；确认稳定后再考虑把全局默认切到 `buffer-only`。
- 回滚：恢复旧的「exact match + permanent skip」判定即可，无需清理数据；未完成的 assembly job 由既有 TTL 清理。

## Open Questions

以下问题已在 2026-11-22 用真实登录态 Chrome 会话诊断（`modal_id=7710926097772479141`）：

- **已确认**：失败请求是 `206 + Content-Range`，同一个 `douyinvod` URL 的连续区间，total `9,863,325`，例如 `bytes 5801361-7152881/9863325`、`bytes 7152882-9736663/9863325`、`bytes 9736664-9863324/9863325`。属于形态 A，因此 `206` 免探针路径即可放行。
- **已确认**：页面不是 shadow DOM / iframe，`<video>` 位于 `xg-video-container`，祖先类名 `video_7710926097772479141`，`data-e2e="feed-active-video"`；`src` / `currentSrc` 是 `blob:`，但 `srcObject` 为 `false`（播放器把 `MediaSource` 的对象 URL 赋给 `src`）。
- **已确认**：页面同时存在多个 progressive 信息流视频，旧探针因此得到 `progressive` 而不是 `mse`，随后因 host/path 不匹配判为 `unverified-source`。这正是旧门禁的假阴性。
- **已确认**：页面 URL 使用 `modal_id` 而不是 `/video/<id>`；实现已支持从 `modal_id` / `aweme_id` / `item_id` 提取页面媒体标识。
- **已确认**：媒体 URL 带 `__vid=7710926097772479141`，与 `modal_id` 一致。
- **仍待验证**：能否在 `loadingFinished` 之前读到这些 206 响应体（受 Network buffer 与请求 abort 影响）；以及从「打开弹窗前开始捕获」能否得到完整无洞覆盖。这两项需要在扩展实际运行时做端到端验证。
- **仍待验证**：3 次 / 10 秒的重试预算是否合适；本轮诊断没有触发重试路径（206 直接放行）。


## Verification

2026-11-22：在真实登录态 Chrome 中完成端到端验证。

- 抖音弹窗视频为 MSE 对象 URL，但网络侧是同一 `douyinvod` URL 的连续 206 Range；`206` 免探针路径按预期放行。
- 页面同时存在多个信息流视频；页面聚焦过滤与容量预占生效，背景视频不再占用槽位。
- 捕获开始前已缓冲的头部会被识别；开启补洞后，头部在 job 创建时立即补齐，取消会话时等待在途补洞最多 3 秒。用户确认可以正常入库。
- 补洞请求在页面上下文使用 `credentials: 'omit'`；`include` 会因 CDN 返回通配符 CORS 头而失败；同一 `__vid` 的候选 URL 轮换已覆盖。
