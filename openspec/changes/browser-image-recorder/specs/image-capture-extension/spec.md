## MODIFIED Requirements

### Requirement: 图片检测
扩展必须 (SHALL) 自动检测用户访问网页上的图片，使用 Chrome DevTools API。

**约束**: 仅支持最新版本的 Chrome 浏览器（Chrome 88+），不考虑 Firefox 或其他浏览器。

#### Scenario: 检测页面加载时的静态图片
- **WHEN** 网页完成加载
- **THEN** 扩展必须 (SHALL) 使用 Chrome DevTools Network API 监听图片资源请求

#### Scenario: 判断请求是否为图片
- **WHEN** 网络请求完成
- **THEN** 扩展必须 (SHALL) 检查响应头 `Content-Type` 是否以 `image/` 开头
- **AND** 必须 (SHALL) 不依赖 `request._resourceType`（不稳定内部属性）

#### Scenario: 处理缺失 Content-Type 的情况
- **WHEN** 响应头中没有 `Content-Type` 信息
- **THEN** 扩展可以 (MAY) 检查 URL 扩展名（`.jpg`、`.png` 等）作为备选方案

#### Scenario: 监听动态加载的图片
- **WHEN** 页面动态加载图片（AJAX、懒加载等）
- **THEN** 扩展必须 (SHALL) 通过 DevTools Network 监听器捕获所有图片请求

**不支持的特殊图片类型（第一版本）**:
- **Canvas/WebGL 生成的图片**: 通过 `canvas.toDataURL()` 生成的 `data:` URL 图片
- **Blob URL 图片**: `blob:http://...` 格式的图片
- **原因**: DevTools Network API 无法直接捕获 `data:` 或 `blob:` 请求，强行支持成本高
- **处理方式**: 遇到此类图片时，扩展会忽略并输出控制台警告（开发调试）
- **文档说明**: 在扩展文档和面板说明中明确标注："暂不支持 Canvas/WebGL 生成的 data: URL 或 blob: URL 图片"

#### Scenario: 捕获图片源 URL
- **WHEN** 检测到图片请求
- **THEN** 扩展必须 (SHALL) 提取图片 URL 和请求详情进行处理

### Requirement: 图片下载和传输
扩展必须 (SHALL) 使用 DevTools API 拦截图片内容并将其发送到本地代理服务 (local proxy service)。

#### Scenario: 拦截图片响应内容
- **WHEN** 图片请求完成且确认为图片类型
- **THEN** 扩展必须 (SHALL) 使用 `request.getContent()` 获取图片内容
- **AND** 扩展必须 (SHALL) 处理返回的 `encoding` 参数（通常为 `'base64'`）

#### Scenario: 处理 base64 编码的图片数据
- **WHEN** `getContent()` 返回 base64 编码的内容
- **THEN** 扩展必须 (SHALL) 提取完整的 base64 数据字符串
- **AND** 扩展必须 (SHALL) 从响应头获取 MIME 类型（如 `image/jpeg`）

#### Scenario: 处理非 base64 编码的数据
- **WHEN** `getContent()` 返回非 base64 编码的内容（如 `'utf8'`）
- **THEN** 扩展必须 (SHALL) 使用 `btoa()` 或类似方法转换为 base64

**DevTools 环境中的 encoding 处理方案**:
- **可能的 encoding 类型**:
  - `'base64'` - 已编码，直接使用
  - `'utf8'` - UTF-8 字符串，需要转换
  - `'binary'` - 二进制字符串，需要转换
- **WXT/DevTools 环境实现方法**:
  - 使用 `Buffer` API（Node.js 环境）
  - 或使用 `TextEncoder` + `Uint8Array`（浏览器环境）
  - 示例代码：
    ```typescript
    // utf8 转 base64
    const encoder = new TextEncoder();
    const bytes = encoder.encode(utf8String);
    const base64 = btoa(String.fromCharCode(...bytes));
    ```
- **注意事项**: DevTools 面板环境可能没有 `btoa()`，需要使用上述替代方案

#### Scenario: 发送图片到本地代理
- **WHEN** 图片内容被拦截且转换为 base64 格式
- **THEN** 扩展必须 (SHALL) 通过 HTTP POST 请求将数据发送到本地代理
- **AND** 请求必须 (SHALL) 包含：原始 URL、MIME 类型、base64 数据
- **AND** 扩展必须 (SHALL) 使用 JSON 格式传递数据

#### Scenario: 处理大尺寸图片
- **WHEN** 图片数据超过一定大小（如 10MB）
- **THEN** 扩展可以 (MAY) 显示警告或跳过保存，避免影响性能

**大图片处理策略**:
- **限制阈值**: 10MB（可配置，范围 1MB - 50MB）
- **判断时机**: 使用响应头 `Content-Length` 在拦截时判断（无需下载）
- **处理方式**:
  - 显示警告提示：在 DevTools 面板状态栏显示 "Large image skipped (12MB)"
  - 跳过保存：不发送到代理服务
  - 记录日志：在捕获统计中标记为 "skipped"
- **用户提示位置**: DevTools 面板顶部状态区域（临时提示，3秒后消失）
- **可配置性**: 用户可在面板中设置最大文件大小限制

#### Scenario: 处理代理连接失败
- **WHEN** 本地代理无法访问
- **THEN** 扩展必须 (SHALL) 记录错误并继续运行，不阻塞页面导航

**错误处理机制**:
- **错误记录位置**: 
  - Chrome Storage API（持久化错误日志）
  - DevTools 面板显示（用户可见）
  - Console.log（开发调试）
- **错误记录内容**:
  - 错误类型（连接超时、拒绝连接、网络错误）
  - 错误时间戳
  - 失败的图片 URL
- **用户提示**: 
  - 在 DevTools 面板状态栏显示 "Connection failed"
  - 在图片列表中标记失败项（红色标记）
- **重试机制**:
  - 不自动重试（避免阻塞）
  - 用户可手动重试失败项（可选功能）
  - 失败图片记录到队列，待服务恢复后可手动发送

### Requirement: 存储路径配置
扩展必须 (SHALL) 在 DevTools 面板中提供存储路径配置功能，允许用户自定义图片保存位置。

#### Scenario: 默认存储路径
- **WHEN** 用户首次使用扩展且未配置自定义路径
- **THEN** 扩展必须 (SHALL) 使用默认路径 `~/Downloads/chrome-history` 存储图片
- **AND** 面板必须 (SHALL) 显示当前使用的存储路径

#### Scenario: 用户配置自定义路径
- **WHEN** 用户在 DevTools 面板的配置区域输入新的存储路径
- **THEN** 扩展必须 (SHALL) 验证路径格式是否合法（非空、不含非法字符）
- **AND** 扩展必须 (SHALL) 保存配置到 Chrome Storage API
- **AND** 扩展必须 (SHALL) 将新路径同步到本地代理服务

#### Scenario: 显示当前配置路径
- **WHEN** DevTools 面板打开
- **THEN** 面板必须 (SHALL) 显示当前配置的存储路径
- **AND** 面板应该 (SHOULD) 提供路径输入框和保存按钮

#### Scenario: 路径配置传递到代理服务
- **WHEN** 存储路径配置发生变化
- **THEN** 扩展必须 (SHALL) 通过 HTTP POST 发送新路径到本地代理的配置端点
- **AND** 本地代理必须 (SHALL) 更新其存储目录设置

#### Scenario: 路径配置持久化
- **WHEN** 用户配置存储路径后关闭 DevTools 或重启浏览器
- **THEN** 扩展必须 (SHALL) 通过 Chrome Storage API 恢复之前的配置
- **AND** 本地代理必须 (SHALL) 在启动时获取最新的路径配置

### Requirement: DevTools 面板集成
扩展必须 (SHALL) 在 Chrome DevTools 中提供专用的控制面板。

#### Scenario: 创建 DevTools 面板
- **WHEN** 用户打开 DevTools
- **THEN** 扩展必须 (SHALL) 在 DevTools 中创建一个名为 "Image Recorder" 的面板

#### Scenario: 面板显示捕获状态
- **WHEN** DevTools 面板打开
- **THEN** 面板必须 (SHALL) 显示当前会话捕获的图片列表和统计信息

**统计信息内容**:
- **当前标签页统计**:
  - 捕获图片数量（成功）
  - 跳过图片数量（因过滤规则）
  - 失败图片数量（传输错误）
  - 总文件大小（已捕获图片）
  - 捕获成功率（成功数 / 总拦截数）
- **全局统计**（所有标签页汇总）:
  - 总捕获数量
  - 总文件大小
- **显示范围**: 图片列表仅显示当前标签页的捕获，不包含其他标签页

**图片列表内容**:
- 显示字段：
  - 文件名（哈希）
  - 原始 URL
  - 文件大小
  - MIME 类型
  - 捕获时间
- 排序方式：按捕获时间降序（最新在前）
- **列表限制**: 最多显示最近 100 张图片

**超出100张的处理机制**:
- **达到100张时**: 在面板显示黄色警告条："已达到显示上限 (100 张)，更多图片请通过代理服务查询"
- **继续捕获**: 图片仍会继续捕获和保存到代理服务，但不添加到面板列表
- **统计信息**: 继续计入总捕获数量和总文件大小
- **完整数据**: 用户通过代理 API 查看完整图片列表
- **原因**: 简化面板实现，避免复杂的内存管理

#### Scenario: 面板提供配置选项
- **WHEN** 用户在面板中修改配置
- **THEN** 面板必须 (SHALL) 提供代理端点、过滤规则、开关等配置选项

### Requirement: 代理服务状态监控
扩展必须 (SHALL) 在 DevTools 面板中实时显示本地代理服务的运行状态。

#### Scenario: 显示状态指示器
- **WHEN** DevTools 面板打开
- **THEN** 面板必须 (SHALL) 在顶部显示一个状态指示器（圆点）
- **AND** 绿色圆点表示服务在线运行
- **AND** 红色圆点表示服务离线或无法连接

#### Scenario: 定期检查服务状态
- **WHEN** 面板处于活动状态
- **THEN** 扩展必须 (SHALL) 每 5 秒调用代理服务的 `/health` 端点检查状态
- **AND** 根据响应更新状态指示器颜色

#### Scenario: 服务状态变化提示
- **WHEN** 服务状态从在线变为离线
- **THEN** 面板必须 (SHALL) 将绿色圆点变为红色圆点
- **AND** 面板应该 (SHOULD) 显示简短提示文字（如 "Service offline"）

#### Scenario: 服务恢复提示
- **WHEN** 服务状态从离线变为在线
- **THEN** 面板必须 (SHALL) 将红色圆点变为绿色圆点
- **AND** 面板可以 (MAY) 显示简短提示文字（如 "Service connected"）

#### Scenario: 初始状态检查
- **WHEN** DevTools 面板首次打开
- **THEN** 扩展必须 (SHALL) 立即检查代理服务状态并显示对应的状态指示器

### Requirement: 代理连接配置
扩展必须 (SHALL) 允许用户在 DevTools 面板中配置代理服务端点。

#### Scenario: 默认代理端点
- **WHEN** 未设置自定义配置
- **THEN** 扩展必须 (SHALL) 使用 `http://localhost:3777` 作为默认端点

#### Scenario: 自定义代理端点
- **WHEN** 用户在 DevTools 面板配置自定义端口
- **THEN** 扩展必须 (SHALL) 连接到配置的端点

### Requirement: 扩展激活控制
扩展必须 (SHALL) 在 DevTools 面板中允许用户启用或禁用图片捕获。

#### Scenario: 在面板中切换捕获开关
- **WHEN** 用户在 DevTools 面板点击切换按钮
- **THEN** 扩展必须 (SHALL) 启用或禁用当前页面的图片捕获功能

**捕获开关默认状态**:
- **DevTools 面板打开时**: 捕获开关默认为 **关闭（禁用）**
- **用户操作**: 需手动点击"启用捕获"按钮开始捕获
- **刷新面板**: 开关状态保持为关闭（除非后续加入持久化配置）
- **原因**: 用户主动控制更符合预期，避免打开 DevTools 就自动捕获大量图片导致性能或隐私问题

**捕获开关作用范围**:
- **范围**: 仅当前标签页（不影响其他标签页）
- **每个标签页独立控制**: 不同标签页可独立启用/禁用
- **持久化**: 开关状态保存到 Chrome Storage API
- **重启恢复**: 浏览器重启后恢复各标签页的开关状态
- **默认状态**: 新标签页默认启用捕获

#### Scenario: 面板显示状态指示器
- **WHEN** 扩展处于活动状态
- **THEN** DevTools 面板必须 (SHALL) 显示活动状态和实时捕获计数

**状态指示器显示内容**:
- 活动状态：显示 "Capturing" 或 "Paused"
- 实时计数：当前标签页的捕获数量（动态更新）
- 视觉样式：使用图标或文字标识

### Requirement: 图片过滤
扩展必须 (SHALL) 在 DevTools 面板中支持配置图片过滤规则，在拦截时（下载前）执行过滤判断。

**过滤执行时机**:
- 在网络请求拦截阶段执行过滤（下载前）
- 使用请求头和 URL 信息判断，无需下载完整内容
- 可用的拦截时信息：
  - URL（域名、文件名、扩展名）
  - Content-Type（MIME 类型）
  - Content-Length（文件大小，字节）
  - HTTP 响应状态码

#### Scenario: 最小图片尺寸过滤器
- **WHEN** 用户在面板设置最小尺寸阈值
- **THEN** 扩展必须 (SHALL) 仅捕获文件大小符合阈值的图片

**尺寸定义**: 指文件大小（字节），而非图片宽高尺寸
- **判断方法**: 检查响应头 `Content-Length`
- **默认阈值**: 10KB（10240 字节）
- **可配置范围**: 1KB - 10MB
- **过滤时机**: 拦截时立即判断（无需下载图片内容）

#### Scenario: 域名白名单
- **WHEN** 用户在面板指定允许的域名
- **THEN** 扩展必须 (SHALL) 仅捕获来自这些域名的图片

**域名匹配规则**:
- **匹配方式**: 精确匹配域名（不支持通配符）
- **域名提取**: 从请求 URL 中提取主机名（hostname）
- **示例**:
  - `google.com` 匹配 `google.com` 但不匹配 `www.google.com`
  - `www.google.com` 仅匹配 `www.google.com`
- **多域名支持**: 允许配置多个域名（逗号分隔或列表选择）
- **默认行为**: 未配置白名单时捕获所有域名的图片

#### Scenario: 图片类型过滤器
- **WHEN** 用户在面板选择图片类型
- **THEN** 扩展必须 (SHALL) 仅捕获 `Content-Type` 匹配指定类型的图片

**过滤时机**: 拦截时检查响应头 `Content-Type`

**支持的图片格式及其 MIME 类型**:
- **JPEG/JPG**: `image/jpeg` - 最常见的压缩格式，适用于照片
- **PNG**: `image/png` - 支持透明度，适用于图标和图形
- **GIF**: `image/gif` - 支持动画，适用于动态图片
- **WebP**: `image/webp` - Google 现代格式，更小体积，高质量
- **BMP**: `image/bmp` - Windows 位图，无损但体积大（较少使用）
- **TIFF**: `image/tiff` - 专业摄影格式，高质量（较少使用）
- **SVG**: `image/svg+xml` - 矢量图形（**完全不支持，跳过处理**）
- **ICO**: `image/x-icon` / `image/vnd.microsoft.icon` - 图标格式（较少使用）

**SVG 处理策略**:
- **检测**: 当检测到 `Content-Type: image/svg+xml` 时
- **处理**: 直接标记为"已跳过（SVG）"，不调用 `getContent()` 也不发送到代理
- **统计**: 在统计中增加"跳过的 SVG 数量"
- **原因**: SVG 通常体积小、数量少，且需特殊处理（文本格式），跳过可减少复杂度

**主流推荐格式**:
- **优先支持**: JPEG、PNG、WebP（覆盖 95% 的网页图片）
- **次要支持**: GIF、BMP、TIFF
- **不支持**: SVG（第一版本明确不支持）

#### Scenario: 性能优化 - 防止捕获过多图片
- **WHEN** 页面包含大量图片（如超过 50 张）
- **THEN** 扩展可以 (MAY) 实现请求队列化或限制并发发送数量
- **AND** 扩展可以 (MAY) 跳过尺寸过小的图片（如小于 1KB 的图标）

**性能优化策略实现**:
- **并发限制策略**（优先实现）:
  - 最大并发请求数：5 个同时发送到代理服务
  - 使用 Promise 队列控制并发
  - 其他图片在队列中等待
- **请求队列化**（可选实现）:
  - 队列大小限制：最多 100 张图片排队
  - 超过限制时丢弃最早的图片
  - 或提示用户手动清理
- **跳过小图标**（自动应用）:
  - 使用最小文件大小过滤器（见上文）
  - 默认跳过小于 10KB 的图片
  - 用户可调整阈值
- **可配置性**: 用户可在面板中启用/禁用性能优化策略

### Requirement: Manifest V3 权限配置（使用 WXT）
扩展必须 (SHALL) 使用 WXT 框架自动生成 manifest.json，在配置文件中声明必要的权限。

#### Scenario: WXT 配置权限
- **WHEN** 扩展需要配置权限和主机权限
- **THEN** 必须 (SHALL) 在 `wxt.config.ts` 中配置 manifest 字段
- **AND** WXT 必须 (SHALL) 自动生成正确的 manifest.json

#### Scenario: DevTools 入口点配置
- **WHEN** 扩展需要创建 DevTools 面板
- **THEN** 必须 (SHALL) 创建 `entrypoints/devtools/index.ts` 入口点
- **AND** WXT 必须 (SHALL) 自动添加 `devtools_page` 字段到 manifest

#### Scenario: 主机权限配置
- **WHEN** 扩展需要与本地代理通信
- **THEN** wxt.config.ts 必须 (SHALL) 在 `manifest.host_permissions` 配置 localhost 访问权限

## ADDED Requirements

### Requirement: Chrome 专属功能
扩展必须 (SHALL) 仅针对最新版本的 Chrome 浏览器设计，充分利用 Chrome 特有的 API。

#### Scenario: 仅使用 Manifest V3
- **WHEN** 扩展加载
- **THEN** 扩展必须 (SHALL) 使用 Manifest V3 规范（Chrome 88+）

#### Scenario: 使用 Chrome DevTools API
- **WHEN** 拦截图片请求
- **THEN** 扩展必须 (SHALL) 使用 Chrome 特有的 DevTools Network API

#### Scenario: 不支持其他浏览器
- **WHEN** 在非 Chrome 浏览器中安装
- **THEN** 扩展必须 (SHALL) 明确提示用户仅支持 Chrome 浏览器

### Requirement: DevTools 连接管理
扩展必须 (SHALL) 正确管理 DevTools 会话连接。

#### Scenario: 监听 DevTools 打开事件
- **WHEN** 用户打开 DevTools
- **THEN** 扩展必须 (SHALL) 初始化 DevTools 连接和面板

#### Scenario: 处理 DevTools 关闭
- **WHEN** 用户关闭 DevTools
- **THEN** 扩展必须 (SHALL) 保持后台连接以继续捕获（如果已启用）

#### Scenario: 支持多标签页 DevTools
- **WHEN** 用户同时打开多个标签页的 DevTools
- **THEN** 扩展必须 (SHALL) 为每个标签页维护独立的捕获状态

**多标签页管理机制**:
- **标签页标识**: 使用 `chrome.tabs.Tab.id` 作为唯一标识符
- **状态存储**: 每个标签页的捕获状态存储在独立的 Map 结构中：`Map<tabId, CaptureState>`
- **捕获状态数据结构**: 包含以下字段
  - `isEnabled`: boolean - 是否启用捕获
  - `capturedImages`: ImageInfo[] - 已捕获图片列表
  - `captureCount`: number - 捕获计数
  - `lastCaptureTime`: Date - 最后捕获时间
- **面板显示范围**: DevTools 面板仅显示当前标签页的捕获列表和状态
- **统计信息范围**: 统计信息显示所有标签页的汇总数据（总捕获数、总大小）

#### Scenario: 标签页关闭时清理状态
- **WHEN** 用户关闭标签页
- **THEN** 扩展必须 (SHALL) 清理该标签页的捕获状态和内存占用
- **AND** 扩展必须 (SHALL) 从状态 Map 中移除该标签页的记录

#### Scenario: 标签页刷新时重置状态
- **WHEN** 用户刷新标签页
- **THEN** 扩展必须 (SHALL) 重置该标签页的捕获列表（清空）
- **AND** 扩展必须 (SHALL) 保持捕获开关状态（不重置 isEnabled）

## REMOVED Requirements

### Requirement: Content Script 图片检测
**Reason**: 使用 DevTools API 提供更强大和精确的图片拦截能力，可以捕获所有网络请求而不依赖 DOM

**Migration**: 从 content script 方案迁移到 DevTools Network API 方案

### Requirement: 扩展 Popup 界面
**Reason**: 将控制和配置界面集成到 DevTools 面板中，提供更专业和集成化的用户体验

**Migration**: 将 popup UI 功能迁移到 DevTools 面板