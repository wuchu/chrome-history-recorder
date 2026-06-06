## Context

现有项目已实现图片捕获功能：
- **NetworkListener**: 使用 `chrome.devtools.network.onRequestFinished` API 拦截网络请求
- **DevTools 面板**: Vue 组件显示捕获状态、统计、图片列表
- **代理服务**: Express.js HTTP 服务器，处理文件存储，使用 SHA-256 哈希去重

视频捕获面临的技术挑战：
- 视频文件通常较大（几 MB 到几百 MB），需要处理大文件上传
- DevTools API 的 `request.getContent()` 对大文件可能有性能限制
- 需要区分视频请求和其他媒体请求

## Goals / Non-Goals

**Goals:**
- 扩展 NetworkListener 支持视频 MIME 类型拦截
- 在 DevTools 面板中显示视频捕获统计和列表
- 支持常见视频格式（MP4、WebM、MOV、AVI）
- 继承现有哈希去重机制
- 处理大文件上传（增加请求体大小限制）

**Non-Goals:**
- 不支持流媒体视频（HLS、DASH）的实时录制
- 不支持视频转码或压缩
- 不支持视频预览播放

## Decisions

### 1. 复用现有 `/save-image` 端点 vs 新建 `/save-video` 端点

**决定**: 复用 `/save-image` 端点，统一命名为 `/save-media`

**理由**:
- 图片和视频的处理逻辑相似（接收 base64、计算哈希、存储）
- 减少代码重复
- 简化客户端调用

**备选方案**: 新建独立端点 - 增加维护成本，无明显优势

### 2. 视频内容获取方式

**决定**: 使用 `request.getContent()` API，依赖 DevTools 的内容缓存

**理由**:
- 与图片处理方式一致，代码改动最小
- DevTools 会缓存响应内容，适用于中小型视频（<50MB）

**备选方案**: 使用 `chrome.devtools.network.getResponseBodyByRequestId` - 功能相同，API 更新版本

**风险**: 大文件可能超出 DevTools 缓存限制，需要设置合理的最小尺寸过滤

### 3. 文件大小限制配置

**决定**: 代理服务增加请求体大小限制至 100MB

**理由**:
- 现有配置为 50MB，部分视频可能超过此限制
- 100MB 可覆盖大多数网页短视频

**实现**: Express.js 的 `express.json({ limit: '100mb' })`

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 大视频文件导致内存压力 | 设置合理的最小尺寸过滤（建议 1MB），过滤小图标类视频 |
| DevTools 缓存限制导致大文件获取失败 | 添加失败计数统计，用户可查看失败原因 |
| 视频请求可能使用分段加载 | 暂不支持流媒体，仅捕获完整视频文件 |
| 某些视频 URL 无扩展名 | 依赖 MIME type 判断格式 |

## Implementation Approach

### NetworkListener 修改

```typescript
// 新增视频 MIME 类型支持
private readonly SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',  // MOV
  'video/x-msvideo',  // AVI
  'video/ogg'
];

// 修改 handleRequest，增加视频判断
private async handleRequest(request: any): Promise<void> {
  const mimeType = this.getMimeType(request);
  
  if (mimeType?.startsWith('image/')) {
    // 现有图片处理逻辑
  } else if (mimeType?.startsWith('video/')) {
    // 新增视频处理逻辑
    this.handleVideoRequest(request, mimeType);
  }
}
```

### UI 修改

- 增加视频统计区域（捕获数量、总大小、失败数）
- 增加视频列表区域（与图片列表分Tab显示或合并显示）
- 配置区域增加视频类型过滤选项