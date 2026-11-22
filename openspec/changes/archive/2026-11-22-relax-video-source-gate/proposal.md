## Why

`buffer-only` 的视频来源验证把「页面 `<video>` 是否指向该媒体 URL」当成硬门槛，导致合法的 progressive 媒体在读取任何字节之前就被标成 `unverified-source` 丢弃。当前抖音抓取中已出现具体证据：一条 `v95-web-sz.douyinvod.com/...?mime_type=video_mp4&br=3792&__vid=...` 的资源，事件日志为 `video:skipped` + `unverified-source`；URL 形态不像 `.m4s` / `.ts` 分片。

根因是验证方式对页面实现细节过于敏感：

- 探针只查顶层文档的 `document.querySelectorAll('video')`，不穿透 shadow DOM、不查 iframe；
- 只读 `currentSrc`，不读 `src`；响应到达时 video 元素可能尚未挂载，`currentSrc` 仍为空；
- 匹配要求 `origin + pathname` 完全一致，而抖音会轮换 CDN host、在播放中重新签名；
- 探针结果缓存 3 秒，`unverified-source` 又以 URL 为键永久拉黑；一次时机不对就会把整条资源判死。

结果：同样是抖音，`<video src="https://...">` 且 host/path 恰好一致的视频能抓，播放器实现稍有不同（shadow DOM、blob、CDN 轮换、懒挂载、多 video 元素）就全部丢失。这不是区间账本的问题，而是来源门禁的假阴性。

## What Changes

- **网络形状优先**：`206 + Content-Range` 直接进入区间账本，不再依赖 `<video>` 探针；同一 URL 出现多个不同 Range 且 total 一致，也视为强证据。
- **页面聚焦过滤**：当页面 URL 暴露稳定媒体标识（`modal_id`、`aweme_id`、`/video/<id>`）时，只组装 `__vid` 与页面标识一致的主视频；搜索/信息流预加载的其他视频不占用组装槽位。页面聚焦变化时，非匹配的活跃 job 会被中止以释放容量。
- **容量可恢复**：并发上限从 4 提升到 8；达到上限时不再永久跳过资源，而是延迟并允许后续响应重试。
- **缺失头部提示**：如果第一个观察到的区间不从 0 开始，说明视频在捕获开始前已经缓冲；默认在会话事件中提示「刷新页面后重播」，避免无意义地长时间停留在缓冲中。
- **可选补齐缺失区间**：新增默认开启（可在 Options 关闭）的 `videoAssemblyFillGaps` 设置。开启后，扩展只对缺失区间在页面上下文向同一媒体 URL 发起 Range 请求（必要时尝试同一 `__vid` 的其他签名 URL），再写入 assembly job；仍然不会重新下载完整文件。
- **分层匹配**：从「origin + pathname 完全相等」改为按证据强度匹配——稳定媒体标识（`__vid`、`aweme_id`、路径尾段）优先，其次 host-insensitive path，最后才要求 origin + path；完全没有任何证据时才判 `unverified-source`。
- **探针增强**：`allFrames: true`，递归 shadow root，读取 `src` 与 `currentSrc`；在 `loadedmetadata` / `playing` 或后续 Range 到达时重试。
- **非永久跳过**：`unverified-source` 不再以 URL 为单位永久拉黑；只跳过当前响应，后续响应可重试（有次数上限和退避），导航或会话结束时清空。
- **保留防误收**：m3u8 / mpd、`.m4s` / `.ts`、`video/iso.segment`、多个互不相同的分片 URL、以及「全 blob 且没有任何 Range 证据」仍然跳过。区间账本、不重试断层、不重新下载完整文件的语义不变；补洞默认开启，关闭后保持原行为。
- **可诊断**：会话事件与调试日志记录响应状态、`Content-Range`、探针来源数、匹配策略和失败原因；`video:skipped` 的 UI 文案不再暗示「字节未完整」。
- **Non-goal**：本变更不采集真正的 MSE 分片字节，不引入 `SourceBuffer.appendBuffer` 拦截、`MediaRecorder`、页面 JSON 兜底下载或 yt-dlp。真正 blob-only 的页面仍会跳过，留待独立变更。

## Capabilities

### New Capabilities

<!-- None: this change modifies existing capabilities only. -->

### Modified Capabilities

- `buffered-video-assembly`: 修改来源资格（Source eligibility）与跳过语义。新增网络形状优先、分层来源匹配、探针覆盖范围、可重试的 `unverified-source`，并在跳过事件中携带诊断信息。
- `capture-session`: 扩展 `video:skipped` 事件的诊断字段与用户可见文案，区分「来源无法验证」与「字节未完整」；`video:assembling` 事件增加缺失头部与补洞状态的 detail。
- `extension-options-config`: 视频捕获设置增加默认捕获模式、按站点覆盖，以及默认开启、可关闭的「补齐缺失区间」开关。

## Impact

- `packages/extension`：`background/video-source-probe.ts`（范围、shadow DOM、iframe、重试）、`background/video-assembly-controller.ts`（网络形状优先、分层匹配、非永久跳过）、`shared/video-assembly.ts`（媒体标识与路径匹配）、`background/debugger-capture.ts`（把响应状态/Range 作为证据传入）、`background/capture-session-store.ts` 与 Side Panel 文案。
- 测试：来源匹配（`__vid`、host 轮换、路径尾段）、206 免探针、`unverified-source` 可重试、分片防误收。
- 不改动 `packages/app` / `packages/vfs` 的接口，不新增依赖，不修改 assembly 临时文件与完整性门禁。
