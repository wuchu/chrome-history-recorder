## MODIFIED Requirements

### Requirement: 媒体详情面板
DevTools 面板必须 (SHALL) 提供媒体详情查看面板，并提供针对单个媒体项的 AI 重新处理操作。

#### Scenario: 点击缩略图打开详情
- **WHEN** 用户点击缩略图
- **THEN** 系统必须 (SHALL) 打开详情面板
- **AND** 详情面板必须 (SHALL) 显示在右侧或弹出层

#### Scenario: 大图预览
- **WHEN** 详情面板打开
- **THEN** 系统必须 (SHALL) 显示媒体的大图预览
- **AND** 图片必须 (SHALL) 使用较高分辨率（如 400px 宽度）
- **AND** 视频必须 (SHALL) 提供播放控件（如支持）

#### Scenario: 分类结果详情
- **WHEN** 媒体已分类
- **THEN** 系统必须 (SHALL) 显示详细分类信息：
  - Category: 分类名称
  - Filename: 新文件名
  - Confidence: 置信度进度条
  - Tags: 标签列表

#### Scenario: 文件信息详情
- **WHEN** 详情面板显示
- **THEN** 系统必须 (SHALL) 显示文件元信息：
  - Hash: 文件哈希值
  - Size: 文件大小（带单位）
  - Type: MIME 类型
  - Captured: 捕获时间

#### Scenario: 来源信息
- **WHEN** 详情面板显示
- **THEN** 系统必须 (SHALL) 显示来源信息：
  - URL: 来源 URL（可点击跳转）
  - Page: 查看原页面链接

#### Scenario: 操作按钮
- **WHEN** 详情面板显示
- **THEN** 系统必须 (SHALL) 提供操作按钮：
  - 重新分类/重命名：将该文件重新加入 AI 分类和 AI 文件名生成队列
  - 删除：删除该文件
  - 导出：下载文件
  - 复制文件名：复制新文件名到剪贴板

#### Scenario: 重新分类操作反馈
- **WHEN** 用户点击重新分类/重命名按钮
- **THEN** 系统必须 (SHALL) 显示该媒体项已重新加入队列
- **AND** 对应卡片和详情面板必须 (SHALL) 显示等待或处理中状态

#### Scenario: 关闭详情面板
- **WHEN** 用户点击关闭按钮
- **THEN** 系统必须 (SHALL) 关闭详情面板
- **AND** 系统必须 (SHALL) 返回网格视图

## ADDED Requirements

### Requirement: 媒体卡片快速操作
DevTools 面板必须 (SHALL) 支持从媒体网格卡片快速触发 AI 重新处理。

#### Scenario: 显示快速操作
- **WHEN** 用户悬停或聚焦媒体卡片
- **THEN** 系统必须 (SHALL) 显示重新分类/重命名快速操作

#### Scenario: 触发快速重新处理
- **WHEN** 用户点击媒体卡片上的重新分类/重命名快速操作
- **THEN** 系统必须 (SHALL) 将该媒体 hash 发送给 Background 重新入队
- **AND** 系统必须 (SHALL) 更新该卡片的分类状态

### Requirement: 分类进度控制区
DevTools 面板必须 (SHALL) 在分类进度区域提供队列和调度器控制。

#### Scenario: 显示开始和暂停控制
- **WHEN** 分类进度区域显示
- **THEN** 系统必须 (SHALL) 显示当前分类处理状态
- **AND** 系统必须 (SHALL) 提供开始或暂停按钮

#### Scenario: 显示队列维护控制
- **WHEN** 分类进度区域显示
- **THEN** 系统必须 (SHALL) 提供重试失败任务和清空队列操作
- **AND** 操作完成后必须 (SHALL) 刷新队列统计
