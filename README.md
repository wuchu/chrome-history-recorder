# Chrome Media Recorder

一个专为 Chrome 浏览器设计的媒体自动捕获系统，使用 DevTools API 拦截网页图片和视频并通过本地代理服务保存到本地。

## 项目简介

本项目能够自动捕获和保存用户浏览网页时看到的图片和视频，无需手动保存每个文件。

### 核心特性

- **Chrome 专属**: 支持 Chrome 88+，使用 Manifest V3 和 DevTools API
- **DevTools 集成**: 在 Chrome DevTools 中集成专用面板，提供实时监控和配置
- **智能去重**: 基于 SHA-256 内容哈希，自动防止重复保存
- **多格式支持**: 图片（JPEG、PNG、WebP、GIF、BMP）和视频（MP4、WebM、MOV、AVI）

## 项目结构

```
chrome-history-recorder/
├── packages/
│   ├── extension/          # Chrome 媒体捕获扩展 → [详细说明](packages/extension/README.md)
│   ├── proxy/              # 本地代理服务 → [详细说明](packages/proxy/README.md)
│   └── ai-classify/        # AI 文件分类工具 → [详细说明](packages/ai-classify/README.md)
├── openspec/               # 项目规划和规范文档
├── package.json            # Monorepo 根配置
└── pnpm-workspace.yaml     # pnpm 工作区配置
```

## 快速开始

### 前置要求

- Node.js 18+
- pnpm 8+
- Chrome 88+

### 安装

```bash
pnpm install
```

### 开发

一键启动所有服务：

```bash
pnpm dev
```

或单独启动：

```bash
pnpm dev:extension    # 启动扩展开发模式
pnpm dev:proxy        # 启动代理服务
```

### 构建

```bash
pnpm build
```

构建产物：`packages/extension/.wxt/chrome-mv3/`

### 加载扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `packages/extension/.wxt/chrome-mv3/` 目录

## 子模块文档

| 模块        | 说明                       | 文档                                        |
| ----------- | -------------------------- | ------------------------------------------- |
| extension   | Chrome 扩展，DevTools 面板 | [README.md](packages/extension/README.md)   |
| proxy       | 本地代理服务，文件存储     | [README.md](packages/proxy/README.md)       |
| ai-classify | AI 文件分类 CLI 工具       | [README.md](packages/ai-classify/README.md) |

## 技术栈

- **扩展框架**: WXT 0.20+
- **前端框架**: React 18+
- **语言**: TypeScript 5.6+
- **后端**: Express.js 4.18+
- **包管理**: pnpm 8+

## 许可证

MIT License
