## 1. 诊断与基线

- [x] 1.1 在失败样例页记录媒体响应的 HTTP 状态（200/206）、`Content-Range`、请求 `Range` 头，确认属于形态 A 还是形态 B
- [x] 1.2 在 DevTools 中递归 shadow root、遍历所有 frame，列出每个 `<video>` 的 `src`、`currentSrc` 与 `srcObject`，确认探针为什么没有匹配
- [x] 1.3 记录当前 `video:skipped` 事件的 reason 与 detail（若为空），作为改造前基线

## 2. 证据模型与匹配

- [x] 2.1 在 `shared/video-assembly.ts` 增加稳定媒体标识提取：`__vid`、`aweme_id`、长路径尾段（≥16 字符）
- [x] 2.2 实现分层匹配：exact URL → stable identifier → host-insensitive path → none
- [x] 2.3 实现来源证据分级：`206 + Content-Range`、重复 Range 且 total 一致、source 匹配、无证据
- [x] 2.4 单测覆盖：host 轮换、`__vid` 匹配、路径尾段匹配、query 变化、blob/data 不参与匹配、短尾段不匹配

## 3. 探针增强

- [x] 3.1 探针改为 `allFrames: true`，注入函数递归 shadow root 收集 `<video>`，读取 `src`、`currentSrc`、`srcObject` 是否存在
- [x] 3.2 单 frame 执行失败或超时与其他 frame 隔离；整体失败返回 `unverified` 而不是抛错
- [x] 3.3 调整缓存：`progressive` / `mse` 缓存 3 秒，`unverified` 只缓存 500ms 且不写入永久跳过表
- [x] 3.4 单测覆盖探针分类：全 blob、http、混合、空、shadow/iframe 汇总后的结果

## 4. 门禁与重试

- [x] 4.1 `206 + Content-Range` 直接创建 assembly job，不再依赖 `<video>` 探针
- [x] 4.2 同一 URL 出现至少两个不同 Range 且 total 一致时，视为强证据并允许组装
- [x] 4.3 `200` 整包仍走分层匹配；未命中证据时不创建 job
- [x] 4.4 将 `unverified-source` 从永久跳过改为 `unverifiedAttempts` 计数：最多 3 次或 10 秒，导航/停止时清空
- [x] 4.5 仅在重试预算耗尽时发出终态 `unverified-source` skip 事件；中间失败不写终态、不刷日志
- [x] 4.6 保留 playlist / segment / 全 blob 无 Range / size-limit 的终态跳过规则
- [x] 4.7 单测覆盖：206 免探针、重复 Range 放行、重试后成功、预算耗尽、真分片不被误收
- [x] 4.8 页面聚焦过滤：页面暴露 modal_id / aweme_id / `/video/<id>` 时只组装 `__vid` 匹配的主视频
- [x] 4.9 页面聚焦变化时中止不匹配的活跃 job；capacity 改为延迟重试，不再永久跳过
- [x] 4.10 可选补洞：仅对缺失区间在页面上下文发起带凭证的 Range 请求，1 MiB 分块，最多 3 轮

## 5. 诊断与 UI

- [x] 5.1 构造有长度上限的 detail：`status`、`range/total`、`evidence`、`probe`、`sources`、`matching`、`attempts`，不包含完整签名 query
- [x] 5.2 扩展 `SessionEvent` / `SessionEventInput` / CaptureSessionStore，使 `video:skipped` 携带 detail
- [x] 5.3 Side Panel：`video:skipped` 标签改为「视频已跳过」，展示 detail；`unverified-source` 不再显示为「字节未完整」
- [x] 5.4 单测覆盖 detail 生成、截断、事件字段与旧快照兼容
- [x] 5.5 新增 `videoAssemblyFillGaps` 配置（默认开启，可关闭）与 Options 开关及风险说明
- [x] 5.6 缺失头部时在 `video:assembling` detail 中提示刷新页面；补洞开启时显示补齐状态

## 6. 验证

- [x] 6.1 抖音形态 A 样例（206 / 多 Range）：完整播放后能入库，AI 任务与缩略图正常
- [x] 6.2 抖音形态 B 样例（200 + shadow DOM / blob 播放器）：在证据命中后能入库
- [x] 6.3 真分片页面（多个独立 `.m4s` / `.ts` URL）仍然跳过，不产生碎片文件
- [x] 6.4 `re-download` 模式行为不回归
- [x] 6.5 运行 `pnpm test`、`pnpm lint`、`pnpm build` 和 `openspec validate relax-video-source-gate`
- [x] 6.6 搜索页多视频场景：主视频能拿到组装槽位，背景视频不再触发 capacity
- [x] 6.7 开启补洞后，捕获前已缓冲的视频能被补齐并入库；关闭时显示刷新提示
