# Chrome Media Recorder Extension

Chrome 扩展，通过 DevTools API 拦截网页媒体请求并保存到本地。

## 功能

- DevTools 集成面板，实时监控媒体捕获
- 智能去重（SHA-256 内容哈希）
- 支持图片（JPEG、PNG、WebP、GIF、BMP）和视频（MP4、WebM、MOV、AVI）
- 可配置过滤规则（最小大小、类型）
- 深色/浅色主题自动适配
- 多语言支持（跟随 Chrome DevTools 语言）

## 开发

```bash
# 开发模式
pnpm dev

# 构建
pnpm build

# 打包 zip
pnpm zip
```

## 配置

通过 DevTools 面板配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 主题 | 自动/亮色/深色 | 自动 |
| 图片最小大小 | KB | 10 KB |
| 视频最小大小 | MB | 1 MB |
| 代理端点 | HTTP 地址 | http://localhost:3777 |

## 结构

```
extension/
├── src/
│   ├── entrypoints/
│   │   ├── background/        # Service Worker
│   │   └── devtools-panel/    # DevTools 面板
│   │       ├── components/    # React 组件
│   │       ├── hooks/         # 自定义 Hooks
│   │       └── locales/       # 国际化文件
│   └── utils/                 # 工具模块
└── wxt.config.ts              # WXT 配置
```

## 技术栈

- WXT 0.20+ (扩展框架)
- React 18+
- TypeScript 5.6+
- CSS Modules
- i18next (国际化)