## 1. 依赖安装

- [x] 1.1 添加 sharp 库
- [x] 1.2 添加 uuid 库
- [x] 1.3 更新 patterns 支持 mp4

## 2. 图片预处理模块

- [x] 2.1 创建 imagePreprocessor.ts
- [x] 2.2 实现 convertToPng 函数
- [x] 2.3 实现 preprocessImage 函数
- [x] 2.4 实现临时文件清理

## 3. 视频帧提取模块

- [x] 3.1 创建 videoFrameExtractor.ts
- [x] 3.2 实现 extractFrame 函数
- [x] 3.3 实现 ffmpeg 可用性检查
- [x] 3.4 处理 ffmpeg 未安装时的错误

## 4. 分类器集成

- [x] 4.1 修改 classifyFile
- [x] 4.2 修改 classifyImage
- [x] 4.3 新增 classifyVideo
- [x] 4.4 更新文件类型检测

## 5. 测试验证

- [x] 5.1 webp 转换成功
- [x] 5.2 jpg/png 直接处理
- [x] 5.3 mp4 帧提取成功
- [x] 5.4 临时文件清理正常