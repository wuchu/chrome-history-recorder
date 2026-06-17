## MODIFIED Requirements

### Requirement: Media details panel
The DevTools Panel SHALL provide a focused media viewer that opens from a thumbnail and prioritizes viewing the local VFS-backed original image.

#### Scenario: 点击缩略图打开查看器
- **WHEN** 用户点击缩略图
- **THEN** 系统必须 (SHALL) 打开媒体查看器
- **AND** 查看器必须 (SHALL) 显示为弹出层或覆盖层

#### Scenario: 本地 VFS 原图预览
- **WHEN** 图片查看器打开
- **THEN** 系统必须 (SHALL) 使用媒体 hash 构建本地 VFS 原图 URL
- **AND** 图片 URL 必须 (SHALL) 指向 `GET /files/:hash`
- **AND** 系统禁止 (MUST NOT) 优先使用或回退到原始页面的 source URL 作为查看器图片源

#### Scenario: 大图查看体验
- **WHEN** 图片查看器打开
- **THEN** 系统必须 (SHALL) 将图片作为主要视觉内容显示
- **AND** 图片必须 (SHALL) 在可用视口内按比例完整显示
- **AND** 元数据内容禁止 (MUST NOT) 与大图争抢主要显示区域

#### Scenario: 查看器标题
- **WHEN** 图片查看器打开
- **THEN** 查看器必须 (SHALL) 在左上角显示图片标题
- **AND** 标题必须 (SHALL) 优先显示 AI 重命名后的文件名
- **AND** 没有重命名文件名时必须 (SHALL) 显示媒体 hash

#### Scenario: 视频预览不可用
- **WHEN** 查看器打开的媒体不是图片
- **THEN** 系统必须 (SHALL) 显示视频预览不可用状态
- **AND** 系统禁止 (MUST NOT) 尝试用图片查看器加载视频源

#### Scenario: 查看器操作按钮
- **WHEN** 查看器显示
- **THEN** 系统必须 (SHALL) 提供关闭操作
- **AND** 系统禁止 (MUST NOT) 在原图查看器工具栏显示下载操作
- **AND** 系统禁止 (MUST NOT) 在原图查看器工具栏显示旋转或重新分类/重命名图标操作

#### Scenario: 关闭查看器
- **WHEN** 用户点击关闭按钮、点击查看器背景或按 Escape 键
- **THEN** 系统必须 (SHALL) 关闭查看器
- **AND** 系统必须 (SHALL) 返回网格视图

### Requirement: 服务状态聚合
DevTools 面板必须 (SHALL) 显示当前 Extension/VFS 架构下的服务状态。

#### Scenario: 显示 VFS 状态
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示 VFS Service 或 VFS WebSocket 连接状态
- **AND** 状态必须 (SHALL) 使用统一尺寸的状态圆点和文字

#### Scenario: 显示 Ollama 状态
- **WHEN** DevTools 面板显示
- **THEN** 系统必须 (SHALL) 显示 Ollama 服务可用状态
- **AND** 状态必须 (SHALL) 使用与其他连接状态一致尺寸的状态圆点
- **AND** 不可用时必须 (SHALL) 提供可操作的检查或重试提示

#### Scenario: 显示 AI 分类状态
- **WHEN** 分类队列状态可用
- **THEN** 系统必须 (SHALL) 显示 AI 分类运行中或暂停状态
- **AND** 状态必须 (SHALL) 包含当前队列处理数量

#### Scenario: 状态图标聚合
- **WHEN** 多个服务状态显示
- **THEN** 系统必须 (SHALL) 在状态栏聚合显示当前可用性
- **AND** 连接状态圆点大小必须 (SHALL) 保持统一

