## MODIFIED Requirements

### Requirement: 图片检测
扩展必须 (SHALL) 自动检测用户访问网页上的图片，使用 Background Service Worker 中的 Chrome debugger/CDP Network 捕获后端。

**约束**: 仅支持最新版本的 Chrome 浏览器（Chrome 88+），不考虑 Firefox 或其他浏览器。

#### Scenario: 检测页面加载时的静态图片
- **WHEN** 捕获已对当前标签页启用且网页加载图片资源
- **THEN** Background 必须 (SHALL) 通过 Chrome debugger/CDP Network 事件监听图片资源响应
- **AND** 图片检测不得 (MUST NOT) 依赖 Side Panel 或 DevTools 页面中的网络监听能力

#### Scenario: 判断请求是否为图片
- **WHEN** CDP Network 响应事件到达
- **THEN** 扩展必须 (SHALL) 检查响应头 `Content-Type` 是否以 `image/` 开头
- **AND** 必须 (SHALL) 不依赖 `request._resourceType`（不稳定内部属性）

#### Scenario: 处理缺失 Content-Type 的情况
- **WHEN** 响应头中没有 `Content-Type` 信息
- **THEN** 扩展可以 (MAY) 检查 URL 扩展名（`.jpg`、`.png` 等）作为备选方案

#### Scenario: 监听动态加载的图片
- **WHEN** 页面动态加载图片（AJAX、懒加载等）且捕获仍处于启用状态
- **THEN** 扩展必须 (SHALL) 通过 Background debugger/CDP Network 监听器捕获图片请求

**不支持的特殊图片类型（第一版本）**:
- **Canvas/WebGL 生成的图片**: 通过 `canvas.toDataURL()` 生成的 `data:` URL 图片
- **Blob URL 图片**: `blob:http://...` 格式的图片
- **原因**: CDP Network 只能可靠捕获网络响应，无法直接还原页面内生成的 `data:` 或 `blob:` 图片
- **处理方式**: 遇到此类图片时，扩展会忽略并输出调试日志
- **文档说明**: 在扩展文档中明确标注："暂不支持 Canvas/WebGL 生成的 data: URL 或 blob: URL 图片"

#### Scenario: 捕获图片源 URL
- **WHEN** 检测到图片请求
- **THEN** 扩展必须 (SHALL) 提取图片 URL 和请求详情进行处理

### Requirement: 图片下载和传输
扩展必须 (SHALL) 使用 Background debugger/CDP Network API 获取图片响应内容，并将其发送到现有 VFS 保存链路。

#### Scenario: 拦截图片响应内容
- **WHEN** 图片请求完成且确认为图片类型
- **THEN** Background 必须 (SHALL) 在 `Network.loadingFinished` 后调用 `Network.getResponseBody` 获取图片内容
- **AND** 扩展必须 (SHALL) 处理 CDP 返回的 `base64Encoded` 标记

#### Scenario: 处理 base64 编码的图片数据
- **WHEN** `Network.getResponseBody` 返回 `base64Encoded: true`
- **THEN** 扩展必须 (SHALL) 提取完整的 base64 数据字符串
- **AND** 扩展必须 (SHALL) 从 CDP 响应头获取 MIME 类型（如 `image/jpeg`）

#### Scenario: 处理非 base64 编码的数据
- **WHEN** `Network.getResponseBody` 返回 `base64Encoded: false`
- **THEN** 扩展必须 (SHALL) 将返回的 body 字符串转换为字节数据
- **AND** 保存到 VFS 的 buffer 必须 (SHALL) 表示原始响应内容

#### Scenario: 发送图片到 VFS 保存链路
- **WHEN** 图片内容被捕获并转换为 buffer
- **THEN** Background 必须 (SHALL) 调用现有媒体保存流程
- **AND** 保存请求必须 (SHALL) 包含：原始 URL、MIME 类型、buffer 数据、捕获时间
- **AND** 非重复保存成功后必须 (SHALL) 进入现有分类队列

#### Scenario: 处理大尺寸图片
- **WHEN** 图片数据超过配置或默认最大大小
- **THEN** 扩展可以 (MAY) 显示警告或跳过保存，避免影响性能

**大图片处理策略**:
- **限制阈值**: 10MB（可配置，范围 1MB - 50MB）
- **判断时机**: 优先使用响应头 `Content-Length` 在读取 body 前判断
- **处理方式**:
  - 在 Side Panel 状态区域显示跳过或失败提示
  - 跳过保存：不发送到 VFS 保存链路
  - 记录日志：在捕获统计中标记为 skipped
- **用户提示位置**: Side Panel 状态区域或捕获事件流
- **可配置性**: 用户可通过支持的配置界面设置最大文件大小限制

#### Scenario: 处理 VFS 连接失败
- **WHEN** VFS 服务无法访问
- **THEN** 扩展必须 (SHALL) 记录错误并继续运行，不阻塞页面导航
- **AND** Side Panel 必须 (SHALL) 显示 VFS 未连接或保存失败状态

### Requirement: DevTools 面板集成
扩展不再要求 (SHALL NOT require) Chrome DevTools 专用面板作为主要控制面板；主要媒体捕获和浏览 UI 必须 (SHALL) 位于 Chrome Side Panel。

#### Scenario: 使用 Side Panel 控制捕获
- **WHEN** 用户需要启动或停止捕获
- **THEN** 用户必须 (SHALL) 能从 Chrome Side Panel 完成该操作
- **AND** 系统不得 (MUST NOT) 要求用户打开 DevTools 面板才能捕获图片

#### Scenario: DevTools 面板作为临时兼容入口
- **WHEN** 迁移期间仍存在 DevTools 面板文件
- **THEN** 系统可以 (MAY) 保留其作为临时调试或回退入口
- **AND** 文档和主流程必须 (SHALL) 将 Side Panel 作为支持的主要入口

### Requirement: 扩展激活控制
扩展必须 (SHALL) 在 Side Panel 中允许用户启用或禁用当前标签页的图片捕获。

#### Scenario: 在 Side Panel 中切换捕获开关
- **WHEN** 用户在 Side Panel 点击切换按钮
- **THEN** Side Panel 必须 (SHALL) 请求 Background 启用或禁用当前标签页的图片捕获功能
- **AND** Background 必须 (SHALL) 为该标签页附着或释放 debugger/CDP 捕获后端

**捕获开关默认状态**:
- **Side Panel 打开时**: 捕获开关默认为 **关闭（禁用）**，除非已存在该标签页的活跃捕获状态
- **用户操作**: 需手动点击"启用捕获"按钮开始捕获
- **刷新面板**: 面板必须 (SHALL) 从 Background 读取当前标签页捕获状态
- **原因**: 用户主动控制更符合预期，避免打开 Side Panel 就自动捕获大量图片导致性能或隐私问题

**捕获开关作用范围**:
- **范围**: 仅当前标签页（不影响其他标签页）
- **每个标签页独立控制**: 不同标签页可独立启用/禁用
- **状态存储**: Background 必须 (SHALL) 使用 tab-scoped capture state 管理捕获状态
- **关闭标签页**: Background 必须 (SHALL) 停止并清理该标签页的捕获状态

#### Scenario: 面板显示状态指示器
- **WHEN** 扩展处于活动状态
- **THEN** Side Panel 必须 (SHALL) 显示活动状态和实时捕获计数

**状态指示器显示内容**:
- 活动状态：显示 "Capturing" 或 "Paused"
- 实时计数：当前标签页的捕获数量（动态更新）
- 视觉样式：使用图标或文字标识

### Requirement: Manifest V3 权限配置（使用 WXT）
扩展必须 (SHALL) 使用 WXT 框架自动生成 manifest.json，在配置文件中声明 Side Panel、debugger、存储、本地服务访问和其他必要权限。

#### Scenario: WXT 配置权限
- **WHEN** 扩展需要配置权限和主机权限
- **THEN** 必须 (SHALL) 在 `wxt.config.ts` 中配置 manifest 字段
- **AND** WXT 必须 (SHALL) 自动生成正确的 manifest.json

#### Scenario: Side Panel 入口点配置
- **WHEN** 扩展需要创建右侧 Side Panel
- **THEN** 必须 (SHALL) 创建 Side Panel entrypoint
- **AND** WXT 必须 (SHALL) 生成 `side_panel.default_path` 字段
- **AND** manifest 权限必须 (SHALL) 包含 `sidePanel`

#### Scenario: Debugger 捕获权限配置
- **WHEN** 扩展使用 Background debugger/CDP 捕获图片响应体
- **THEN** manifest 权限必须 (SHALL) 包含 `debugger`
- **AND** 捕获启用失败时系统必须 (SHALL) 向 Side Panel 返回错误状态

#### Scenario: 主机权限配置
- **WHEN** 扩展需要与本地 VFS/Ollama 服务通信
- **THEN** wxt.config.ts 必须 (SHALL) 在 `manifest.host_permissions` 配置 localhost 访问权限

### Requirement: Chrome 专属功能
扩展必须 (SHALL) 仅针对最新版本的 Chrome 浏览器设计，充分利用 Chrome 特有的 Side Panel 和 debugger/CDP API。

#### Scenario: 仅使用 Manifest V3
- **WHEN** 扩展加载
- **THEN** 扩展必须 (SHALL) 使用 Manifest V3 规范（Chrome 88+）

#### Scenario: 使用 Chrome debugger/CDP API
- **WHEN** 拦截图片请求
- **THEN** 扩展必须 (SHALL) 使用 Chrome 特有的 debugger/CDP Network API

#### Scenario: 使用 Chrome Side Panel API
- **WHEN** 显示主要媒体捕获和浏览 UI
- **THEN** 扩展必须 (SHALL) 使用 Chrome Side Panel API

#### Scenario: 不支持其他浏览器
- **WHEN** 在非 Chrome 浏览器中安装
- **THEN** 扩展必须 (SHALL) 明确提示用户仅支持 Chrome 浏览器

### Requirement: DevTools 连接管理
扩展必须 (SHALL) 正确管理 Side Panel 会话和 Background debugger 捕获连接。

#### Scenario: 监听 Side Panel 打开事件
- **WHEN** 用户打开 Side Panel
- **THEN** 扩展必须 (SHALL) 初始化 Side Panel UI 和 Background 消息连接
- **AND** Side Panel 必须 (SHALL) 读取当前标签页捕获状态

#### Scenario: 处理 Side Panel 关闭
- **WHEN** 用户关闭 Side Panel
- **THEN** 扩展必须 (SHALL) 按配置或产品策略停止捕获或保持后台捕获
- **AND** 当前策略必须 (SHALL) 在 UI 或文档中明确表达

#### Scenario: 支持多标签页捕获状态
- **WHEN** 用户在多个标签页之间切换或启用捕获
- **THEN** 扩展必须 (SHALL) 为每个标签页维护独立的捕获状态

**多标签页管理机制**:
- **标签页标识**: 使用 `chrome.tabs.Tab.id` 作为唯一标识符
- **状态存储**: 每个标签页的捕获状态存储在独立的 Map 结构中：`Map<tabId, CaptureState>`
- **捕获状态数据结构**: 包含以下字段
  - `isEnabled`: boolean - 是否启用捕获
  - `capturedImages`: ImageInfo[] - 已捕获图片列表
  - `captureCount`: number - 捕获计数
  - `lastCaptureTime`: Date - 最后捕获时间
  - `debuggerAttached`: boolean - 是否已附着 debugger 捕获后端
- **面板显示范围**: Side Panel 显示当前活动标签页的捕获状态和全局 VFS 历史媒体
- **统计信息范围**: 统计信息显示当前标签页捕获状态和 VFS/分类队列聚合状态

#### Scenario: 标签页关闭时清理状态
- **WHEN** 用户关闭标签页
- **THEN** 扩展必须 (SHALL) 停止该标签页捕获并 detach debugger
- **AND** 扩展必须 (SHALL) 从状态 Map 中移除该标签页的记录

#### Scenario: 标签页刷新时维护状态
- **WHEN** 用户刷新标签页
- **THEN** 扩展必须 (SHALL) 重置该标签页的实时捕获列表
- **AND** 扩展必须 (SHALL) 根据既有捕获开关状态重新建立可用的 CDP Network 监听

## REMOVED Requirements

### Requirement: Content Script 图片检测
**Reason**: Side Panel migration requires Background-owned capture. Content Script detection still cannot reliably capture all network image response bodies.
**Migration**: Use Background debugger/CDP Network capture for image detection and response-body extraction.

### Requirement: 扩展 Popup 界面
**Reason**: The primary UI is Chrome Side Panel, which remains available during browsing and supports a larger media browser than popup.
**Migration**: Use the Side Panel media browser for capture and browsing; use the Options page for configuration.
