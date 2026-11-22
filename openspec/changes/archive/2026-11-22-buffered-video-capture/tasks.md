## 1. 验证与准备

- [x] 1.1 在抖音 watch 页挂 debugger，记录完整播放一条视频的全部 `responseReceived`（status、`Content-Range`、`Content-Length`、`loadingFinished` / `loadingFailed`），确认是否使用 progressive `<video src>`
- [x] 1.2 用 1.1 的数据计算区间并集，确认完整播放后是否无洞覆盖 `[0, total)`；记录典型片段数量与大小
- [x] 1.3 验证 `chrome.debugger` 下 `Network.getResponseBody` 对 20MB / 80MB 响应的可用性与耗时
- [x] 1.4 验证 `Network.streamResourceContent` 可用性、`bufferedData` 与后续 `dataReceived.data` 的偏移语义
- [x] 1.5 将实测结论补充到 `design.md` 的 Open Questions（若与假设不符，先调整设计再继续）

## 2. 共享类型与配置

- [x] 2.1 在 `packages/extension/src/shared/extension-runtime.ts` 和 `packages/app/src/types.ts` 增加 `VideoCaptureMode`、`videoCaptureMode`、`videoCaptureModeByHost`
- [x] 2.2 在配置归一化中实现主机后缀匹配、默认值与旧配置补齐；补充单元测试
- [x] 2.3 在扩展与 app 的配置镜像中透传新增字段，并验证 `updateConfig` 后运行中的捕获立即生效

## 3. 区间账本纯函数

- [x] 3.1 实现区间合并与覆盖判断（乱序、重叠、相邻、首尾缺口、total=0、边界越界）于独立模块
- [x] 3.2 为 3.1 编写 Vitest：完整单段、多段无洞、单洞、多洞、重叠幂等、total 不一致
- [x] 3.3 实现资源键归一化（tabId + 最终 response URL）与缺失 total 的判定逻辑
- [x] 3.4 定义稳定的跳过原因枚举，并补充类型测试

## 4. VFS assembly sink

- [x] 4.1 新增 `AssemblyManager`：创建 job、一次性 token、临时文件、区间记录、并发上限
- [x] 4.2 实现按 offset 写入、越界与空 body 拒绝、幂等重叠写入
- [x] 4.3 实现 finalize：服务端覆盖校验、`saveFileFromStream` 入库、临时文件清理
- [x] 4.4 实现 abort、不活动 TTL、启动时残留临时文件清理；补充日志
- [x] 4.5 在 `packages/vfs/src/http-server.ts` 注册 `POST /assemblies`、`PUT /assemblies/:jobId/chunks`、`POST /assemblies/:jobId/complete`、`DELETE /assemblies/:jobId`
- [x] 4.6 端点安全：token 校验、`application/octet-stream` 限制、offset 边界、不向普通网页授予 CORS
- [x] 4.7 为 4.1–4.6 编写 Vitest（含不完整拒绝、token 错误、越界、并发上限、TTL）

## 5. 扩展响应分类与模式门控

- [x] 5.1 在 `debugger-capture.ts` 按页面主机解析捕获模式；`re-download` 保持现有候选与下载链路
- [x] 5.2 `buffer-only` 下将视频响应登记为区间，不再创建下载候选
- [x] 5.3 识别并跳过 HLS/DASH manifest、`video/iso.segment`、`video/mp2t`、`.m4s` / `.ts` 路径，记录 `playlist`
- [x] 5.4 跳过 `blob:` / `data:` 媒体，记录 `in-memory`
- [x] 5.5 处理同一 URL 的重复 Range、total 变化与未知 total，并记录对应跳过原因
- [x] 5.6 为分类与门控补充单元测试（不依赖真实 CDP）

## 6. 页面源探针

- [x] 6.1 实现 `currentSrc` 探针：读取页面 `<video>` 的 `currentSrc`，区分 `blob:`（MSE）与 HTTP 源
- [x] 6.2 按 origin + path 将媒体 URL 与页面视频源匹配；无法判断时记录 `unverified-source` 并跳过
- [x] 6.3 缓存探针结果，避免每个响应都注入脚本；在导航时失效
- [x] 6.4 为探针的匹配/降级逻辑补充单元测试

## 7. Debugger body 读取与传输

- [x] 7.1 在 `loadingFinished` 后通过 `Network.getResponseBody` 读取 body，校验长度后 PUT 到 assembly job
- [x] 7.2 对超过 `ASSEMBLY_INLINE_BODY_LIMIT` 的区间启用 `Network.streamResourceContent`，按累计偏移分块 PUT
- [x] 7.3 同一 tab 串行化 body 读取，避免内存峰值叠加；失败时记录 `body-unavailable`
- [x] 7.4 `loadingFailed` 时标记区间未提交，并记录 `aborted`
- [x] 7.5 确保 body 字节不进入扩展的完整文件内存缓冲，验证大区间内存占用

## 8. Assembly 生命周期与会话

- [x] 8.1 新增扩展侧 assembly 控制器：首次响应建 job、提交区间、覆盖完成时立即 finalize
- [x] 8.2 会话停止、标签页关闭、页面导航时 abort 所有未完成 job 并记录 `incomplete`
- [x] 8.3 将 job 元数据写入 `chrome.storage.session` 快照；实现 SW 重启后的恢复与清理
- [x] 8.4 在 `capture-session-store.ts` 增加 `video:assembling`、`video:complete`、`video:skipped` 事件与计数器
- [x] 8.5 对 `video:assembling` 做节流，避免高频 chunk 写满事件日志

## 9. Side Panel 与 Options

- [x] 9.1 Side Panel 展示装配进度（已收字节 / 总字节）与完整捕获卡片
- [x] 9.2 Side Panel 展示不完整跳过原因与缺失字节数；提示「开始捕获后未完整加载」
- [x] 9.3 Options 增加视频捕获模式配置（全局默认 + 主机覆盖），或提供等价的配置文件入口
- [x] 9.4 更新 i18n 文案（中文/英文）与样式

## 10. 端到端验证

- [x] 10.1 抖音实测：完整播放后自动入库，AI 任务被入队，缩略图正常
- [x] 10.2 抖音实测：看到一半后停止，资源被丢弃并给出 `incomplete` 与缺失字节数
- [x] 10.3 抖音实测：拖动进度条留洞，资源被丢弃（不发生补洞/重下）
- [x] 10.4 实测 `re-download` 站点行为不回归
- [x] 10.5 运行 `pnpm test`、`pnpm lint`、`pnpm build` 并修复问题

## 11. 文档

- [x] 11.1 更新 `ARCHITECTURE.md`：buffer-only 与 re-download 两条视频链路、assembly 端点
- [x] 11.2 更新 `README.md` 中视频捕获能力说明与限制（读不到缓存、必须会话内捕获）
- [x] 11.3 运行 `openspec validate buffered-video-capture` 并修正规范问题
