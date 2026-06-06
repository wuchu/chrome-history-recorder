## Context

Chrome 扩展运行在沙箱环境中，无法直接访问文件系统。要在本地保存图片，我们需要在浏览器和文件系统之间建立桥梁。本设计使用本地 HTTP 服务器作为中介，允许扩展将图片发送到服务器，然后服务器将其写入磁盘。

本项目专为最新版本的 Chrome 浏览器设计，充分利用 Manifest V3 和 Chrome DevTools API 的最新功能。不考虑 Firefox、Edge 或旧版 Chrome 的兼容性问题。

系统由两个主要组件组成：
1. **Chrome 扩展 (Chrome extension)** - 在 Chrome 中运行，使用 DevTools API 拦截图片，将其发送到代理
2. **本地代理服务 (local proxy service)** - 处理文件系统操作的 HTTP 服务器

## Goals / Non-Goals

**Goals:**
- 自动捕获访问网页中的图片，无需用户交互
- 使用内容哈希 (content hash) 命名存储图片以实现去重
- 提供简单的本地 API 用于读/写操作
- 保持两个组件简洁且可维护
- 充分利用 Chrome DevTools API 的最新功能

**Non-Goals:**
- 视频或其他媒体捕获（仅限图片）
- 云存储或远程同步
- 复杂的图片处理或转换
- 用户认证或多用户支持
- Firefox 或其他浏览器支持
- 旧版 Chrome 兼容（仅支持 Chrome 88+，Manifest V3）

## Decisions

### 1. Chrome 扩展架构
**决策**: 使用 Manifest V3 配合 DevTools API 和后台服务工作线程 (background service worker)，仅支持最新版 Chrome。

**理由**:
- Manifest V3 是新 Chrome 扩展的必需版本（Chrome 88+）
- DevTools Network API 可以拦截所有网络请求，包括图片
- 后台服务工作线程管理 DevTools 连接和与本地代理的通信
- DevTools 面板提供专业的配置和控制界面
- 仅支持 Chrome 可以充分利用最新 API，无需考虑兼容性问题

**考虑的备选方案**:
- Manifest V2: 已弃用，Chrome Web Store 不再接受
- Content script 方案: 无法拦截所有网络请求，仅能检测 DOM 中的图片，对动态加载图片支持有限
- 跨浏览器支持: 需要适配 Firefox WebExtensions API，增加维护成本且功能受限
- 仅扩展（无本地服务）: 由于沙箱限制无法写入本地文件系统

### 2. 本地代理服务技术
**决策**: Node.js 配合 Express（或使用内置 `http` 模块的精简 HTTP 服务器）。

**理由**:
- 依赖最小，易于通过 `pnpm start` 运行
- 跨平台（在 Windows、Mac、Linux 上工作）
- 简单的 HTTP API 易于调试和扩展

**包管理器**: pnpm（快速、磁盘高效、严格的依赖解析）

**考虑的备选方案**:
- Python Flask: 也可行，但 Node.js 与前端工具链更契合
- Native messaging: 设置更复杂，需要单独的主机 manifest 安装
- npm/yarn: pnpm 提供更好的磁盘空间效率和更快的安装速度

### 10. 扩展开发框架
**决策**: 使用 WXT 框架进行 Chrome 扩展开发。

**理由**:
- WXT 是专为浏览器扩展设计的现代化开发框架
- 自动处理 Manifest V3 配置和权限
- 提供热重载（HMR）开发体验
- 内置 TypeScript 支持和类型定义
- 自动化的构建和打包流程
- 零配置支持 DevTools 面板开发
- 简化的项目结构和文件组织

**核心特性**:
- **自动 Manifest**: WXT 根据入口点自动生成 manifest.json
- **入口点定义**: 使用 `entrypoints/` 目录组织代码
  - `entrypoints/background.ts` - Service Worker
  - `entrypoints/devtools/index.ts` - DevTools 入口
  - `entrypoints/devtools/panel/index.ts` - DevTools 面板
- **热重载**: 开发时自动刷新扩展和 DevTools 面板
- **TypeScript**: 类型安全的 Chrome API 调用
- **构建优化**: 自动优化和打包扩展代码

**备选方案**:
- 手动配置: 需要手动编写 manifest.json、配置构建工具、处理热重载
- CRXJS: 专注于 Vite 集成，但不如 WXT 对扩展特性的支持全面
- Plasmo: 另一个扩展框架，但 WXT 更轻量且专注

**开发流程**:
- `pnpm wxt dev` - 启动开发模式（热重载）
- `pnpm wxt build` - 构建生产版本
- `.wxt/` - WXT 配置目录（wxt.config.ts）

## Risks / Trade-offs
**决策**: 图片内容的 SHA-256 哈希，前 16 个字符作为文件名。

**理由**:
- SHA-256 是标准、支持良好、抗碰撞的
- 前 16 个字符（64 位）足以在我们的规模下进行去重
- 保留原始文件扩展名以便查看

**格式**: `<hash>.<ext>`（例如 `a1b2c3d4e5f6g7h8.jpg`）

### 4. 存储目录结构
**决策**: 基于日期的子目录，按天组织（YYYY-MM-DD 格式）。

**结构**:
```
<storage-dir>/<YYYY-MM-DD>/<hash>.<ext>
```

**示例**:
```
./images/2024-01-15/a1b2c3d4e5f6g7h8.jpg
./images/2024-01-15/b2c3d4e5f6g7h8i9.png
./images/2024-01-16/c3d4e5f6g7h8i9j0.jpg
```

**理由**:
- 易于按捕获日期浏览和整理图片
- 按日期范围清理旧图片更简单
- 避免单一目录包含数千文件（影响文件系统性能）
- ISO 日期格式具有通用可排序性

### 5. 通信协议
**决策**: localhost 上的 HTTP REST API（默认端口 3777）。

**端点**:
- `POST /save-image` - 保存图片（body: JSON 包含 `url`、`mimeType`、`data`，返回哈希）
  - 接收 base64 数据（可能为 data URL 或纯 base64）
  - 正确解析两种格式（包含逗号或不包含）
  - 使用 `Buffer.from()` 转换为二进制
- `POST /config/storage-path` - 更新存储路径配置（body: JSON 包含 `path`）
  - 验证路径格式合法性
  - 自动创建目录结构
  - 支持跨平台路径格式
- `GET /config/storage-path` - 获取当前存储路径配置
- `GET /images` - 列出所有保存的图片
- `GET /images/:hash` - 检索图片
- `DELETE /images/:hash` - 删除图片
- `GET /health` - 健康检查

**默认配置**:
- 默认存储路径: `~/Downloads/chrome-history`
- Body 解析限制：`limit: '50mb'`（处理大尺寸图片）
- 文件名生成：`<timestamp>_<basename>.<ext>`
- 从 MIME 类型提取扩展名（如 `image/jpeg` → `jpg`）

**理由**:
- 简单的 REST API 易于实现和调试
- JSON 格式传递数据便于扩展元数据
- 大 body limit 防止大图片保存失败
- 健康检查允许扩展验证代理是否运行

### 6. 图片检测策略
**决策**: 使用 DevTools Network API 监听所有图片类型的网络请求。

**理由**:
- DevTools Network API 可以拦截所有网络请求，包括 XHR、Fetch、动态加载的图片
- 可以获取完整的请求和响应信息，包括请求头、响应体
- 不依赖 DOM，可以捕获 CSS 背景图片、懒加载图片等
- 实时监听，无需等待页面完全加载

**实现方式**:
- 在 DevTools 面板初始化时连接到当前标签页的 DevTools 会话
- 使用 `chrome.devtools.network.onRequestFinished` 监听所有请求
- 过滤 MIME 类型为图片的请求（检查响应头 `Content-Type` 是否以 `image/` 开头）
- 使用 `request.getContent()` 获取图片内容（返回 base64 编码和 encoding 参数）
- 处理不同的 encoding 类型：`'base64'` 直接使用，其他编码使用 `btoa()` 转换

**支持的主流图片格式**:
| 格式 | MIME 类型 | 特性 | 优先级 |
|------|-----------|------|--------|
| **JPEG** | `image/jpeg` | 厸缩格式，适合照片，小体积 | ⭐⭐⭐ 优先 |
| **PNG** | `image/png` | 无损，支持透明，适合图标 | ⭐⭐⭐ 优先 |
| **WebP** | `image/webp` | Google 现代，更小体积 | ⭐⭐⭐ 优先 |
| **GIF** | `image/gif` | 支持动画，动态图片 | ⭐⭐ 推荐 |
| **BMP** | `image/bmp` | Windows 位图，无损 | ⭐ 可选 |
| **TIFF** | `image/tiff` | 专业摄影，高质量 | ⭐ 可选 |

**关键技术点**:
- 不使用 `request._resourceType`（不稳定内部属性）
- Content-Type 检查是最可靠的方法
- 对于缺失 Content-Type 的请求，可检查 URL 扩展名作为备选

**支持范围**:
- 所有 `<img>` 元素的图片
- CSS 背景图片
- 懒加载图片（intersection observer 触发）
- AJAX 动态加载的图片
- Canvas/WebGL 生成的图片（通过 toDataURL）

**排除项**:
- SVG 图片（可后续支持）
- 视频内容

### 7. DevTools 面板设计
**决策**: 在 Chrome DevTools 中创建专用的 "Image Recorder" 面板，包含存储路径配置功能。

**理由**:
- DevTools 面板提供专业的调试和配置环境
- 与网络请求监听在同一上下文中，便于实时显示捕获状态
- 集成化的用户体验，无需切换到扩展 popup
- 可以显示详细的请求信息（URL、大小、类型、时间等）
- 提供存储路径配置界面，允许用户自定义保存位置

**面板功能**:
- **捕获开关**: 默认关闭，需用户手动点击"启用捕获"按钮
  - DevTools 面板打开时开关为禁用状态
  - 用户主动控制，避免意外捕获大量图片
- **服务状态指示器**: 在面板顶部显示绿色/红色圆点，实时显示代理服务运行状态
  - 绿点: 服务在线，健康检查正常
  - 红点: 服务离线或无法连接
  - 每 5 秒自动检查服务状态
  - 状态变化时有视觉提示（可选文字提示）
- **实时捕获列表**: 显示当前会话捕获的所有图片
  - 最多显示最近 100 张图片
  - 达到100张时显示黄色警告条
  - 继续捕获但不显示在列表（计入统计）
- **统计信息**: 显示捕获数量、总大小、成功率等
  - 包含"跳过的 SVG 数量"统计
- **存储路径配置**: 输入框显示和编辑当前存储路径，默认为 `~/Downloads/chrome-history`
- **配置选项**: 代理端点、过滤规则、开关控制
- **请求详情**: 点击图片显示详细请求信息
- **导出功能**: 导出捕获列表或批量下载图片

**配置管理**:
- 使用 Chrome Storage API 持久化用户配置
- 配置变更时自动同步到本地代理服务
- 支持跨平台路径格式（macOS/Linux 的 `~`，Windows 的盘符路径）

**实现方式**:
- 使用 `chrome.devtools.panels.create()` 创建面板
- 面板页面作为独立的 HTML 页面，通过 message passing 与后台通信
- 使用 Chrome Extension APIs 与 DevTools Network 交互

### 8. 用户界面架构
**决策**: 移除扩展 popup，所有控制和配置功能集成到 DevTools 面板。

**理由**:
- 避免界面分散，提供统一的控制入口
- DevTools 面板更适合显示详细的网络请求信息
- popup 方案在页面导航时需要重新打开，不够便捷
- DevTools 面板可以保持打开状态，实时监控捕获过程

**备选方案**:
- 保留 popup + DevTools 面板: 功能重复，增加维护成本
- 仅使用 popup: 无法显示详细的请求信息，用户体验较差

### 9. Manifest V3 权限配置
**决策**: 使用 WXT 框架自动生成 manifest.json，在 `wxt.config.ts` 中配置权限。

**WXT 配置方式**:
```typescript
// wxt.config.ts
export default defineConfig({
  manifest: {
    name: 'Image Recorder',
    permissions: ['activeTab', 'storage'],
    host_permissions: ['http://localhost/', 'http://127.0.0.1/'],
  },
});
```

**入口点自动配置**:
- `entrypoints/devtools/index.ts` → 自动添加 `devtools_page` 字段
- `entrypoints/background.ts` → 自动配置 Service Worker
- WXT 根据入口点自动生成正确的 manifest.json

**理由**:
- WXT 自动处理 manifest 生成，减少手动配置错误
- 集中化的配置文件便于维护
- 开发和生产构建自动适配 manifest 配置
- 无需手动处理权限和入口点的映射

### 11. 多标签页状态管理设计
**决策**: 使用独立的标签页状态管理机制，确保每个标签页的捕获状态隔离。

**实现机制**:
- 使用 `Map<tabId, CaptureState>` 存储每个标签页的状态
- 监听 `chrome.tabs.onRemoved` 事件清理关闭的标签页状态
- 监听 `chrome.tabs.onReplaced` 事件处理标签页刷新

**状态数据结构**:
```typescript
interface CaptureState {
  isEnabled: boolean;           // 捕获开关状态
  capturedImages: ImageInfo[];  // 已捕获图片列表
  captureCount: number;         // 捕获计数
  lastCaptureTime: Date;        // 最后捕获时间
  skippedCount: number;         // 跳过计数
  failedCount: number;          // 失败计数
}
```

**面板显示策略**:
- 图片列表：仅显示当前标签页的捕获
- 统计信息：显示当前标签页 + 全局汇总

### 12. 图片过滤时机决策
**决策**: 在网络请求拦截时执行过滤判断（下载前），避免不必要的下载开销。

**可用信息**（拦截时获取）:
- URL（域名、文件名）
- Content-Type（MIME 类型）
- Content-Length（文件大小）
- HTTP 状态码

**不可用信息**（需下载后获取）:
- 图片宽高尺寸
- 图片内容
- 实际文件大小（如果 Content-Length 不准确）

**过滤优先级**:
1. 先检查域名白名单（最快）
2. 再检查 Content-Type（判断是否图片）
3. 再检查 Content-Length（文件大小）
4. 所有条件满足后才拦截和下载

**过滤决策**:
- **文件大小过滤**: 使用 Content-Length（字节），而非宽高尺寸
- **域名过滤**: 精确匹配，不支持通配符（简化实现）
- **大图片处理**: 在拦截时通过 Content-Length 判断，无需下载
- **SVG 处理**: 完全不支持，检测到 `image/svg+xml` 时跳过
- **Canvas/Blob URL**: 明确不支持第一版本（DevTools API 限制）

**特殊图片类型处理策略**:
- **SVG**: 检测到 `image/svg+xml` 时跳过，统计中标记
- **Canvas/WebGL**: 不支持 `data:` URL，输出控制台警告
- **Blob URL**: 不支持 `blob:http://...` 格式，忽略处理

## Risks / Trade-offs

### WXT 框架依赖
- **权衡**: 依赖第三方框架，可能影响构建灵活性
- **缓解措施**: WXT 是开源框架，社区活跃，可自定义配置；如果需要可退回到手动配置
- **优势**: 相比手动配置，减少 80% 的配置工作，降低出错概率

### DevTools 连接管理
- **风险**: DevTools 会话管理复杂，需要处理多标签页和连接生命周期
- **缓解措施**: 使用清晰的连接状态管理，在后台服务工作线程中维护连接映射

### DevTools API 限制
- **风险**: DevTools API 只在有 DevTools 打开时可用
- **缓解措施**:
  - 提示用户需要打开 DevTools 才能捕获图片
  - 可考虑保留后台监听功能（通过 background fetch API）作为备选方案

### 安全考虑
- **风险**: 本地代理默认接受来自任何来源的请求
- **缓解措施**: CORS 配置仅允许来自扩展 ID 的请求，或在请求头添加简单 API 密钥

### 性能
- **风险**: 高频图片捕获可能影响浏览器性能
- **缓解措施**: 图片捕获去抖动、图片队列化、限制并发上传

### 存储
- **风险**: 存储无限增长
- **缓解措施**: 添加可选大小限制、最旧优先清理（未来增强）

### 重复检测
- **权衡**: 哈希比较在保存时进行；无上传前重复检查
- **影响**: 快速连续保存相同图片可能创建竞态条件
- **缓解措施**: 使用哈希作为主键（更新插入行为 - 如存在则覆盖）