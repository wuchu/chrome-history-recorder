## ADDED Requirements

### Requirement: Extension 缩略图显示
Extension 必须 (SHALL) 在媒体列表中显示缩略图预览。

#### Scenario: MediaItem 缩略图显示
- **WHEN** 显示捕获的媒体项
- **THEN** Extension 必须 (SHALL) 显示媒体缩略图
- **AND** 缩略图 必须 (SHALL) 从 `/images/:hash/thumbnail` API 获取
- **AND** 缩略图尺寸 应该 (SHOULD) 为 80x80 像素

#### Scenario: 缩略图加载失败处理
- **WHEN** 缩略图加载失败
- **THEN** Extension 必须 (SHALL) 显示占位图或文件类型图标
- **AND** Extension 应该 (SHOULD) 显示加载失败提示

#### Scenario: 缩略图懒加载
- **WHEN** 媒体列表滚动
- **THEN** Extension 应该 (SHOULD) 懒加载可见项的缩略图
- **AND** Extension 应该 (SHOULD) 缓存已加载的缩略图

### Requirement: 媒体详情预览
Extension 应该 (SHOULD) 支持点击查看媒体详情。

#### Scenario: 点击打开详情
- **WHEN** 用户点击媒体项
- **THEN** Extension 应该 (SHOULD) 显示媒体详情面板
- **AND** 详情面板 应该 (SHOULD) 包含：
  - 大图预览
  - 分类信息
  - 文件信息
  - 来源 URL 链接

#### Scenario: 详情面板关闭
- **WHEN** 用户点击关闭按钮或背景
- **THEN** Extension 必须 (SHALL) 关闭详情面板
- **AND** Extension 必须 (SHALL) 返回媒体列表