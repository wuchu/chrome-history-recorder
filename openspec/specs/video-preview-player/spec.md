# Purpose

TBD - Video preview player functionality for the media browser.

## Requirements

### Requirement: Video playback in MediaDetail
MediaDetail 组件 SHALL 支持在模态框中播放视频文件。

#### Scenario: Display video player for video items
- **WHEN** 用户点击一个 MIME 类型以 `video/` 开头的媒体项打开 MediaDetail
- **THEN** MediaDetail 显示 HTML5 `<video>` 播放器而非占位符文本

#### Scenario: Video player controls enabled
- **WHEN** 视频播放器渲染
- **THEN** 播放器显示原生控件（播放/暂停、进度条、音量、全屏等）

#### Scenario: Video preloads metadata
- **WHEN** 视频播放器初始化
- **THEN** 视频预加载元数据（时长、尺寸等），不自动加载完整文件

#### Scenario: Fallback for unsupported formats
- **WHEN** 浏览器无法播放该视频格式
- **THEN** 显示友好提示信息，告知用户该格式不被支持

#### Scenario: Video fits within viewer
- **WHEN** 视频加载完成
- **THEN** 视频按比例缩放以适应查看区域，保持宽高比

### Requirement: Video player styling
视频播放器 SHALL 适配现有 UI 风格和主题。

#### Scenario: Video player has proper styling
- **WHEN** 视频播放器显示
- **THEN** 播放器有适当的阴影、圆角等样式，与图片查看器风格一致

#### Scenario: Dark theme compatibility
- **WHEN** 使用深色主题
- **THEN** 视频播放器界面与深色背景协调
