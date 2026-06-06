## Why

用户在浏览网页时经常遇到想要保存的有价值的图片。手动保存每张图片既繁琐又会打断浏览流程。由于安全沙箱限制，浏览器扩展无法直接访问本地文件系统，因此需要一个创新的解决方案来跨越这个鸿沟。

本项目专为现代 Chrome 浏览器设计，充分利用最新的 Chrome DevTools API 和 Manifest V3 功能，无需考虑跨浏览器兼容性或旧版浏览器支持。

## What Changes

- **新 Chrome 扩展**: 使用 WXT 框架开发专为最新版 Chrome 设计的扩展，使用 DevTools API 自动拦截和捕获所有网页图片请求
- **DevTools 面板**: 在 Chrome DevTools 中集成的专用控制面板（使用 WXT 的 DevTools 入口点），提供配置和实时监控功能
  - 服务状态实时监控（绿点/红点指示器）
  - 图片捕获列表显示
  - 配置选项管理
- **本地代理服务**: 一个本地 HTTP 服务器，代表浏览器扩展处理文件系统读写操作
- **内容哈希命名**: 图片根据其内容哈希（SHA-256）命名，以防止重复并实现去重
- **可配置存储**: 用户可以在 DevTools 面板中指定图片存储的本地目录（默认路径：`~/Downloads/chrome-history`）
- **存储路径管理**:
  - 在 DevTools 面板中提供路径配置界面
  - 使用 Chrome Storage API 持久化配置
  - 支持跨平台路径格式（macOS/Linux、Windows）
  - 自动创建目录结构
- **WXT 开发框架**: 使用现代化的 WXT 框架，提供热重载、TypeScript 支持、自动 Manifest 配置等开发体验

## Capabilities

### New Capabilities

- `image-capture-extension`: 使用 DevTools API 拦截和提取网页图片的浏览器扩展 (browser extension)，包含 DevTools 控制面板
- `local-storage-proxy`: 代表浏览器扩展处理文件系统操作（读/写/列表）的本地 HTTP 服务
- `content-deduplication`: 基于哈希的命名和存储，防止重复保存图片

### Modified Capabilities

<!-- 没有现有的能力被修改 -->

## Impact

- **目标平台**: 仅支持最新版本的 Chrome 浏览器（Chrome 88+，支持 Manifest V3）
- **不支持的平台**:
  - Firefox（不兼容 Chrome DevTools API）
  - Edge Legacy（已弃用）
  - 其他浏览器

- **新代码**:
  - Chrome 扩展代码库（使用 WXT 框架的 entrypoints 目录结构）
  - DevTools 面板（React/Vue 组件，通过 WXT DevTools 入口点集成）
  - 本地代理服务（Node.js HTTP 服务器）
- **开发框架**:
  - WXT 框架（现代化的浏览器扩展开发工具）
  - TypeScript（类型安全的开发体验）
  - 热重载支持（开发时自动刷新扩展和面板）
- **依赖**:
  - WXT 核心 API（自动 Manifest V3 配置、入口点管理）
  - Chrome 扩展 API（chrome.devtools、chrome.devtools.network）
  - 本地服务器：Express.js 或类似的 HTTP 框架
  - 用于内容哈希的加密库
- **用户配置**:
  - DevTools 面板中的存储路径配置（默认：`~/Downloads/chrome-history`）
  - 使用 Chrome Storage API 持久化路径设置
  - DevTools 面板中的代理服务端口配置
  - 图片过滤规则：尺寸过滤器、域名白名单、图片类型过滤器
  - 配置自动同步到本地代理服务