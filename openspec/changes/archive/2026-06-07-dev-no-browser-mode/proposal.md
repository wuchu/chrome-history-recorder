## Why

当前 `pnpm dev` 会自动打开浏览器并加载扩展，但在某些场景下用户不希望自动启动浏览器：

1. **CI/CD 环境**：自动化环境中不需要打开浏览器
2. **远程开发**：SSH 或远程桌面环境，无法自动打开本地浏览器
3. **已有浏览器实例**：用户已有正在调试的浏览器，不需要再开新窗口
4. **手动调试偏好**：部分开发者习惯手动加载扩展，便于精确控制

目前 WXT 的 `webExt` 配置会自动启动浏览器，缺少"仅构建不启动"的选项。

## What Changes

- 新增 `pnpm dev:no-browser` 命令，仅启动开发服务器构建扩展，不自动打开浏览器
- 启动后在控制台输出友好的调试提示，指导用户：
  - 打开 Chrome 开发者模式
  - 手动加载 `.wxt/chrome-mv3-dev/` 目录
  - 打开 DevTools 面板查看扩展
- 控制台提示包含：
  - 扩展目录路径
  - Chrome 扩展管理页面链接 (`chrome://extensions/`)
  - DevTools 面板名称
  - 多语言支持（中英文）

## Capabilities

### New Capabilities
- `dev-no-browser-mode`: 无浏览器启动的开发模式，提供友好的手动调试指导

### Modified Capabilities
- 无（不改变现有 `pnpm dev` 行为）

## Impact

- 新增 npm script `dev:no-browser`
- 新增控制台提示模块
- 不影响现有 `pnpm dev` 命令
- 兼容 CI/CD 环境