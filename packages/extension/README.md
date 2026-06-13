# Chrome Media Recorder Extension

Chrome 扩展，通过 DevTools API 拦截网页媒体请求并保存到本地 VFS Service。

## 功能

- DevTools 集成面板，实时监控媒体捕获和分类进度
- Extension Options 配置页，集中管理 Ollama、AI 分类、文件名风格和队列维护
- 智能去重（SHA-256 内容哈希）
- 支持图片（JPEG、PNG、WebP、GIF、BMP）和视频（MP4、WebM、MOV、AVI）
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

通过扩展 Options 页面配置：

| 配置项 | 说明 | 默认值 |
| ------ | ---- | ------ |
| Ollama 地址 | 本地 Ollama HTTP 地址 | http://localhost:11434 |
| 视觉模型 | 用于后续 AI 分类的 Ollama 模型，选择后立即保存 | llava:7b |
| AI 分类状态 | 调度器运行/暂停；默认暂停但捕获媒体仍可入队 | 暂停 |
| 分类并发数 | 后台同时处理的分类任务数 | 1 |
| 文件名风格 | AI 生成 `ai_filename` 的提示风格 | 自动 |

刷新 Ollama 模型列表只更新可选模型，不会覆盖当前已保存的模型选择。

## 结构

```
extension/
├── src/
│   ├── entrypoints/
│   │   ├── background/        # Service Worker
│   │   ├── devtools-panel/    # DevTools 媒体面板
│   │   └── options/           # Options 配置页
│   ├── shared/                # 前端共享运行时消息客户端
│   └── utils/                 # 工具模块
└── wxt.config.ts              # WXT 配置
```

## 技术栈

- WXT 0.20+ (扩展框架)
- React 18+
- TypeScript 5.6+
- Ant Design (Options UI)
- CSS Modules
- i18next (国际化)
