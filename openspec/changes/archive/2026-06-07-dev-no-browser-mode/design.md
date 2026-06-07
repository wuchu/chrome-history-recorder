## Context

当前 WXT 开发模式下，`webExt` 配置会自动启动浏览器并加载扩展：

```typescript
webExt: {
  chromiumArgs: [
    'https://www.baidu.com',
    '--auto-open-devtools-for-tabs'
  ]
}
```

WXT 支持通过环境变量或命令行参数控制浏览器启动行为。使用 `--no-browser` 或禁用 `webExt` 配置可以阻止自动启动。

**用户期望**：
- 开发服务器正常运行（热更新）
- 控制台显示友好提示
- 支持中英文提示

## Goals / Non-Goals

**Goals:**
- 实现 `pnpm dev:no-browser` 命令
- 控制台输出友好调试指导
- 支持多语言（中英文）
- 不改变现有 `pnpm dev` 行为

**Non-Goals:**
- 不修改 WXT 框架本身
- 不实现自动检测浏览器是否已打开
- 不实现扩展自动刷新（WXT 已支持）

## Decisions

### 1. 命令实现：npm script + 环境变量

**方案**：
```json
{
  "scripts": {
    "dev:no-browser": "cross-env NO_BROWSER=1 pnpm dev:extension"
  }
}
```

在 WXT 配置中根据环境变量禁用 `webExt`：

```typescript
export default defineConfig({
  webExt: process.env.NO_BROWSER ? undefined : {
    chromiumArgs: [...]
  }
});
```

**理由**：
- 简单直接，无需修改 WXT 内部逻辑
- 环境变量方式通用性强
- `cross-env` 确保跨平台兼容

### 2. 控制台提示：chalk + i18n

**提示内容**：
```
========================================
  🔧 Chrome 扩展开发模式（无浏览器）
========================================

✓ 开发服务器已启动

📋 手动加载扩展步骤：

1. 打开 Chrome 浏览器
2. 访问 chrome://extensions/
3. 开启右上角"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择目录：
   /path/to/packages/extension/.wxt/chrome-mv3-dev/

💡 提示：
   - 打开任意网页，按 F12 查看 DevTools
   - 在面板列表中找到"Media Recorder"

========================================
```

**理由**：
- 使用 `chalk` 实现彩色输出
- 目录路径动态获取
- 支持中英文切换

### 3. 提示触发时机：WXT dev 事件

在 WXT 的 `hooks` 中添加 `onBuildComplete` 回调，输出提示：

```typescript
hooks: {
  onBuildComplete: () => {
    if (process.env.NO_BROWSER) {
      printDevInstructions();
    }
  }
}
```

## Risks / Trade-offs

| 飅险 | 缓解措施 |
|------|----------|
| 跨平台路径显示 | 使用 `path.resolve()` 获取绝对路径 |
| 环境变量兼容性 | 使用 `cross-env` 包 |
| 提示信息过长 | 使用分隔线和缩进优化显示 |