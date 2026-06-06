# Chrome Media Recorder

一个专为Chrome浏览器设计的媒体自动捕获系统，使用DevTools API拦截网页图片和视频并通过本地代理服务保存到本地。

## 项目简介

本项目能够自动捕获和保存用户浏览网页时看到的图片和视频，无需手动保存每个文件。

### 核心特性

- **Chrome 专属**: 仅支持最新版本 Chrome（Chrome 88+），充分利用 Manifest V3 和 DevTools API
- **DevTools 集成**: 使用 DevTools Network API 拦截所有媒体请求，包括动态加载的内容
- **专业控制面板**: 在 Chrome DevTools 中集成专用面板，提供实时监控和配置功能
  - 服务状态监控（绿色/红色圆点）
  - 图片和视频捕获统计
  - 分 Tab 显示图片和视频列表
  - 配置选项管理
- **智能去重**: 基于 SHA-256 内容哈希的命名系统，自动防止重复保存
- **图片支持**: 支持主流图片格式（JPEG、PNG、WebP、GIF、BMP、TIFF）
- **视频支持**: 支持常见视频格式（MP4、WebM、MOV、AVI）
- **可配置存储**: 用户可自定义保存位置，默认为 `~/Downloads/chrome-history`

### 技术架构

- **开发框架**: WXT（现代化的浏览器扩展开发框架）
  - 自动 Manifest V3 配置
  - Vue.js 组件集成
  - TypeScript 支持
- **Chrome 扩展**: Manifest V3 + DevTools API + Service Worker
- **本地代理服务**: Node.js HTTP 服务器处理文件系统操作
- **DevTools 面板**: Vue 组件集成在 Chrome DevTools 中

## 项目结构

```
chrome-history-recorder/
├── extension/              # Chrome媒体捕获扩展
│   ├── entrypoints/        # WXT入口点目录
│   │   ├── background/     # Service Worker
│   │   └── devtools-panel/ # DevTools面板
│   ├── utils/              # 工具模块
│   └── wxt.config.ts       # WXT配置文件
├── proxy/                  # 本地代理服务
│   ├── src/
│   │   └── server.js       # Express服务器
│   └── package.json
├── ai-classify/            # AI文件分类CLI工具
│   ├── src/                # TypeScript源码
│   ├── dist/               # 构建产物
│   └── README.md           # 使用文档
├── openspec/               # 项目规划和规范文档
├── package.json            # Monorepo根配置
└── pnpm-workspace.yaml     # pnpm工作区配置
```

## 安装和开发

### 前置要求

- Node.js 18+
- pnpm 8+
- Chrome 88+

### 安装依赖

```bash
pnpm install
```

### 启动开发模式

#### 1. 启动代理服务

```bash
pnpm dev:proxy
```

代理服务将在 `http://localhost:3777` 启动。

#### 2. 启动扩展开发模式

```bash
pnpm dev
```

WXT将启动开发服务器并自动打开Chrome浏览器加载扩展。

#### 3. 打开DevTools面板

在Chrome浏览器中：
1. 打开任意网页
2. 按 `F12` 或右键选择"检查"打开DevTools
3. 在DevTools面板列表中找到"Image Recorder"面板
4. 点击面板查看控制界面

### 构建生产版本

```bash
pnpm build
```

构建产物将生成在 `extension/.output/chrome-mv3/` 目录。

### 加载生产版本到Chrome

1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension/.output/chrome-mv3/` 目录
5. 扩展加载成功后，打开DevTools即可看到"Image Recorder"面板

## 使用指南

### 基本使用

1. **启动代理服务**: 确保代理服务正在运行（状态指示器显示绿色圆点）
2. **启用捕获**: 在DevTools面板中点击"开始捕获"按钮启用媒体捕获
3. **浏览网页**: 访问任意网页，系统将自动捕获图片和视频
4. **查看结果**: 在面板中切换 Tab 查看捕获的图片和视频列表及统计信息

### 配置选项

#### 存储路径配置

在DevTools面板的配置区域：
- 默认路径: `~/Downloads/chrome-history`
- 可以自定义路径，点击"保存"按钮应用

#### 图片过滤配置

- **最小大小**: 设置最小文件大小（单位KB），默认10KB
- **类型**: JPEG、PNG、WebP（默认启用）

#### 视频过滤配置

- **最小大小**: 设置最小文件大小（单位MB），默认1MB
- **类型**: MP4、WebM（默认启用），MOV、AVI（可选）

#### 代理端点配置

自定义代理服务端点：
- 默认: `http://localhost:3777`
- 可以修改为其他地址

### 查看捕获结果

#### 通过DevTools面板

- 显示最近100张图片
- 包含文件名、URL、大小、MIME类型
- 按捕获时间降序排列

#### 通过代理API

```bash
# 列出所有图片
curl http://localhost:3777/images

# 检索特定图片
curl http://localhost:3777/images/<hash> --output image.jpg

# 查看统计信息
curl http://localhost:3777/health
```

## 代理服务API文档

### 端点列表

#### `GET /health`
健康检查端点，返回服务状态。

响应示例：
```json
{
  "status": "ok",
  "uptime": 120,
  "storagePath": "~/Downloads/chrome-history",
  "totalImages": 50,
  "totalVideos": 10,
  "totalImageSize": 5242880,
  "totalVideoSize": 104857600,
  "totalSize": 109900480
}
```

#### `POST /save-image`
保存媒体文件（图片或视频）到本地存储。

请求体：
```json
{
  "url": "https://example.com/media.jpg",
  "mimeType": "image/jpeg",
  "data": "base64_encoded_data"
}
```

响应：
```json
{
  "success": true,
  "hash": "a1b2c3d4e5f6g7h8",
  "filename": "a1b2c3d4e5f6g7h8.jpg",
  "filePath": "/path/to/storage/2024-01-15/a1b2c3d4e5f6g7h8.jpg",
  "duplicate": false
}
```

#### `GET /images`
列出所有存储的图片。

可选查询参数：
- `date`: 按日期过滤（格式: YYYY-MM-DD）

响应：图片元数据数组

#### `GET /images/:hash`
检索特定图片。

#### `DELETE /images/:hash`
删除特定图片。

#### `POST /config/storage-path`
更新存储路径配置。

请求体：
```json
{
  "path": "~/Downloads/my-custom-path"
}
```

#### `GET /config/storage-path`
获取当前存储路径配置。

## 支持的媒体格式

### 图片格式

#### 优先支持（主流格式）
- JPEG (`image/jpeg` → `.jpg`)
- PNG (`image/png` → `.png`)
- WebP (`image/webp` → `.webp`)

#### 次要支持
- GIF (`image/gif` → `.gif`)
- BMP (`image/bmp` → `.bmp`)
- TIFF (`image/tiff` → `.tiff`)
- ICO (`image/x-icon` → `.ico`)

#### 不支持
- SVG (`image/svg+xml`) - 自动跳过
- Canvas/WebGL生成的 data: URL - 第一版本不支持
- Blob URL - 第一版本不支持

### 视频格式

#### 优先支持
- MP4 (`video/mp4` → `.mp4`) - 最常见的视频格式
- WebM (`video/webm` → `.webm`) - 网页友好格式

#### 次要支持
- MOV (`video/quicktime` → `.mov`) - QuickTime格式
- AVI (`video/x-msvideo` → `.avi`) - Windows视频格式
- OGG (`video/ogg` → `.ogv`) - 开源格式

#### 不支持
- 流媒体视频（HLS、DASH）- 实时录制不支持
- 直播视频流

## 存储结构

媒体文件按日期组织存储，文件名使用内容哈希：

```
~/Downloads/chrome-history/
├── 2024-01-15/
│   ├── a1b2c3d4e5f6g7h8.jpg    # 图片（内容哈希命名）
│   ├── b2c3d4e5f6g7h8i9.png
│   └── c3d4e5f6g7h8i9j0.mp4    # 视频
├── 2024-01-16/
│   ├── d4e5f6g7h8i9j0k1.webp
│   └── e5f6g7h8i9j0k1l2.mov
```

**哈希命名优势**：
- 自动去重：相同内容的文件不会重复保存
- 内容标识：文件名即内容标识，便于追踪
- 简洁命名：16字符哈希 + 扩展名

## 注意事项

### DevTools API限制

- DevTools API只在DevTools打开时可用
- 需要手动打开DevTools才能捕获媒体
- 关闭DevTools后捕获会暂停

### 隐私和安全

- 媒体文件仅保存在本地，不上传到云端
- 所有数据通过本地HTTP服务传输
- 建议仅在信任的网络环境使用

### 性能考虑

- 大量媒体捕获可能影响浏览器性能
- 系统自动限制并发请求数（最多5个）
- 大图片（>10MB）会被跳过并记录警告
- 视频文件最大支持100MB

### 视频捕获限制

- 仅捕获完整视频文件，不支持流媒体
- 视频内容通过 DevTools API 获取，受浏览器缓存限制
- 大视频可能需要更长处理时间

## 开发技术栈

- **扩展框架**: WXT 0.20+
- **前端框架**: Vue 3.4+
- **语言**: TypeScript 5.6+
- **后端**: Express.js 4.18+
- **包管理**: pnpm 8+

## 许可证

MIT License

## 作者

Chrome Image Recorder Team

---

**翻译日期**: 2026-06-07  
**项目版本**: 0.2.0