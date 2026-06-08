# Chrome Media Recorder Proxy

本地代理服务，处理媒体文件存储和管理。

## 功能

- 接收扩展发送的媒体数据（Base64）
- SHA-256 哈希去重
- 按日期组织存储（YYYY-MM-DD 目录）
- RESTful API 管理
- 调试模式和热重启支持

## 启动

```bash
# 生产模式
pnpm start

# 开发模式（热重启）
pnpm dev
```

默认端口：`3777`

## API

| 端点                   | 方法     | 说明         |
| ---------------------- | -------- | ------------ |
| `/health`              | GET      | 健康检查     |
| `/save-image`          | POST     | 保存媒体     |
| `/images`              | GET      | 列出图片     |
| `/images/:hash`        | GET      | 获取图片     |
| `/images/:hash`        | DELETE   | 删除图片     |
| `/config/storage-path` | GET/POST | 存储路径配置 |

### 调试端点（仅 DEBUG_MODE=true）

| 端点             | 方法 | 说明     |
| ---------------- | ---- | -------- |
| `/debug/status`  | GET  | 服务状态 |
| `/debug/logs`    | GET  | 内存日志 |
| `/debug/restart` | POST | 手动重启 |

## 存储

默认路径：`~/Downloads/chrome-history`

```
~/Downloads/chrome-history/
├── 2024-01-15/
│   ├── a1b2c3d4.jpg
│   └── b2c3d4e5.mp4
└── 2024-01-16/
    └── c3d4e5f6.png
```

文件名：16 字符哈希 + 扩展名

## 技术栈

- Express.js 4.18+
- pino (日志)
- nodemon (热重启)
