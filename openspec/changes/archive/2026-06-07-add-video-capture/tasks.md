## 1. NetworkListener 扩展

- [x] 1.1 在 NetworkListener 类中添加 SUPPORTED_VIDEO_TYPES 常量（MP4、WebM、MOV、AVI、OGG）
- [x] 1.2 添加视频相关统计字段（videoCount、skippedVideoCount、failedVideoCount、totalVideoSize）
- [x] 1.3 修改 handleRequest 方法，增加视频 MIME 类型判断分支
- [x] 1.4 实现 handleVideoRequest 方法，复用现有的内容获取和上传逻辑
- [x] 1.5 添加视频过滤配置（enabledVideoTypes、minVideoSize）

## 2. DevTools 面板 UI 扩展

- [x] 2.1 在 App.vue 中添加视频统计数据响应式变量
- [x] 2.2 在统计区域增加视频统计显示（捕获数、跳过数、失败数、总大小）
- [x] 2.3 添加视频列表区域（与图片列表分 Tab 显示或合并显示）
- [x] 2.4 在配置区域增加视频类型过滤选项
- [x] 2.5 添加最小视频大小配置输入框
- [x] 2.6 实现 updateStats 方法，同步视频统计数据

## 3. 代理服务扩展

- [x] 3.1 在 server.js 中增加请求体大小限制至 100MB
- [x] 3.2 扩展 getExtensionFromMimeType 函数，添加视频 MIME 类型映射
- [x] 3.3 更新健康检查端点，返回视频统计信息
- [ ] 3.4 测试大文件（>50MB）上传功能

## 4. 测试与验证

- [ ] 4.1 测试 MP4 视频捕获功能
- [ ] 4.2 测试 WebM 视频捕获功能
- [ ] 4.3 测试视频去重功能（相同内容不重复保存）
- [ ] 4.4 测试视频过滤功能（按类型、大小）
- [ ] 4.5 测试大视频文件上传（边界情况）
- [ ] 4.6 验证 UI 统计数据正确更新

## 5. 文档更新

- [x] 5.1 更新 README.md，添加视频捕获功能说明
- [x] 5.2 更新 DevTools 面板帮助文本