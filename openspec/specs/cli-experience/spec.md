## ADDED Requirements

### Requirement: 炫酷 CLI 启动画面
CLI 工具必须 (SHALL) 提供视觉吸引力的启动画面，增强用户体验。

#### Scenario: 显示 ASCII Art Logo
- **WHEN** 用户运行 `ai-classify start` 或 `ai-classify init`
- **THEN** 系统必须 (SHALL) 显示 ASCII Art 形式的工具名称 Logo
- **AND** Logo 必须 (SHALL) 使用渐变色或彩色显示
- **AND** Logo 必须 (SHALL) 包含版本号信息

#### Scenario: 显示配置摘要面板
- **WHEN** 启动画面显示完成
- **THEN** 系统必须 (SHALL) 在边框面板中显示当前配置摘要
- **AND** 配置面板必须 (SHALL) 包含以下信息：
  - Input 目录
  - Output 目录
  - Ollama Endpoint
  - Vision Model
  - Language
  - Filename Style
  - Organize 模式

#### Scenario: 显示服务连接状态
- **WHEN** 启动时检测服务连接
- **THEN** 系统必须 (SHALL) 显示各服务的连接状态
- **AND** 状态显示必须 (SHALL) 包含：
  - Ollama Server 连接状态（带图标：✓ Connected / ✗ Disconnected）
  - Input Directory 文件数量
  - Output Directory 准备状态

### Requirement: 进度可视化
CLI 工具必须 (SHALL) 提供直观的处理进度可视化。

#### Scenario: 显示队列状态条
- **WHEN** 文件处理进行中
- **THEN** 系统必须 (SHALL) 显示队列状态进度条
- **AND** 进度条必须 (SHALL) 包含：
  - Pending 数量（带进度条可视化）
  - Processing 数量
  - Completed 数量
  - Failed 数量

#### Scenario: 显示总体进度条
- **WHEN** 文件处理进行中
- **THEN** 系统必须 (SHALL) 显示总体完成百分比进度条
- **AND** 进度条必须 (SHALL) 使用 Unicode 方块字符（如 █░）
- **AND** 进度条必须 (SHALL) 显示完成数量/总数量

#### Scenario: 显示当前任务列表
- **WHEN** 文件处理进行中
- **THEN** 系统必须 (SHALL) 显示当前正在处理和等待的任务列表
- **AND** 每个任务必须 (SHALL) 显示：
  - 文件名
  - 状态图标（◉ 处理中 / ○ 等待 / ✓ 完成 / ✗ 失败）
  - 目标分类目录（如已知）

#### Scenario: 显示实时置信度
- **WHEN** 分类请求正在进行
- **THEN** 系统应该 (SHOULD) 显示实时置信度进度
- **AND** 置信度进度条应该 (SHOULD) 在分类完成后显示最终值

### Requirement: 分类结果展示
CLI 工具必须 (SHALL) 以美观的卡片形式展示分类结果。

#### Scenario: 显示结果卡片
- **WHEN** 单个文件分类完成
- **THEN** 系统必须 (SHALL) 显示结果详情卡片
- **AND** 卡片必须 (SHALL) 包含：
  - Source 文件路径
  - 预览图区域（如果终端支持）
  - Category 分类
  - Filename 新文件名
  - Confidence 置信度（带进度条）
  - Output 输出路径
  - Tags 标签列表

#### Scenario: 显示终端图片预览
- **WHEN** 终端支持图片显示（iTerm2 / SIXEL）
- **THEN** 系统可以 (MAY) 在结果卡片中显示缩略图

### Requirement: 运行时交互
CLI 工具必须 (SHALL) 支持运行时键盘交互。

#### Scenario: 显示交互提示
- **WHEN** 处理运行中
- **THEN** 系统必须 (SHALL) 在底部显示可用的键盘快捷键
- **AND** 快捷键必须 (SHALL) 包含：
  - [P] 暂停
  - [S] 停止
  - [R] 重试失败
  - [V] 详细模式
  - [Q] 安静模式

#### Scenario: 处理暂停按键
- **WHEN** 用户按下 P 键
- **THEN** 系统必须 (SHALL) 暂停处理队列
- **AND** 系统必须 (SHALL) 显示暂停状态

#### Scenario: 处理停止按键
- **WHEN** 用户按下 S 键
- **THEN** 系统必须 (SHALL) 停止处理并优雅退出
- **AND** 系统必须 (SHALL) 保存当前状态以便恢复

#### Scenario: 处理重试按键
- **WHEN** 用户按下 R 键
- **THEN** 系统必须 (SHALL) 重试所有失败的文件

### Requirement: 智能配置向导
CLI 工具必须 (SHALL) 提供智能的交互式配置向导。

#### Scenario: 智能目录检测
- **WHEN** 用户运行 `ai-classify init`
- **THEN** 系统必须 (SHALL) 自动检测当前目录下的可用子目录
- **AND** 系统必须 (SHALL) 提供检测到的目录作为选择选项
- **AND** 系统必须 (SHALL) 提供"手动输入"和"使用默认"选项

#### Scenario: 智能端点检测
- **WHEN** 配置 Ollama Endpoint
- **THEN** 系统必须 (SHALL) 自动检测本地默认端点是否可用
- **AND** 系统应该 (SHOULD) 检测局域网中可能的 Ollama 服务
- **AND** 系统必须 (SHALL) 显示连接状态图标

#### Scenario: 智能模型检测
- **WHEN** 配置 Vision Model
- **THEN** 系统必须 (SHALL) 从 Ollama 获取已安装的模型列表
- **AND** 系统必须 (SHALL) 提供模型列表作为选择选项
- **AND** 系统必须 (SHALL) 标记推荐模型
- **AND** 系统必须 (SHALL) 提示未安装模型时的安装命令

#### Scenario: 显示下一步提示
- **WHEN** 配置完成
- **THEN** 系统必须 (SHALL) 显示配置保存确认
- **AND** 系统必须 (SHALL) 显示下一步操作提示
- **AND** 提示必须 (SHALL) 包含：
  - `ai-classify start` 开始处理
  - `ai-classify status` 查看状态
  - `ai-classify config` 修改配置

### Requirement: 启动动画效果
CLI 工具应该 (SHOULD) 提供流畅的启动动画效果。

#### Scenario: Logo 渐显动画
- **WHEN** 启动画面加载
- **THEN** 系统可以 (MAY) 使用渐显动画显示 Logo

#### Scenario: 面板滑入动画
- **WHEN** 配置面板显示
- **THEN** 系统可以 (MAY) 使用滑入动画效果

#### Scenario: 状态检测动画
- **WHEN** 检测服务连接状态
- **THEN** 系统必须 (SHALL) 显示连接动画（如 ◐ ◑ ◔ ◕ 循环）
- **AND** 连接成功后必须 (SHALL) 显示 ✓ Connected

### Requirement: ANSI 颜色和样式
CLI 工具必须 (SHALL) 使用 ANSI 颜色和 Unicode 字符增强视觉效果。

#### Scenario: 使用颜色区分状态
- **WHEN** 显示任何状态信息
- **THEN** 系统必须 (SHALL) 使用颜色区分：
  - 成功/完成：绿色
  - 处理中：蓝色/黄色
  - 等待：灰色
  - 失败/错误：红色
  - 信息：白色/默认

#### Scenario: 使用 Unicode 边框
- **WHEN** 显示面板和卡片
- **THEN** 系统必须 (SHALL) 使用 Unicode 边框字符
- **AND** 边框字符应该 (SHOULD) 使用 ╔═╗ ┌─┐ 等双线/单线字符

#### Scenario: 使用图标增强可读性
- **WHEN** 显示状态和列表
- **THEN** 系统必须 (SHALL) 使用 Unicode 图标
- **AND** 图标必须 (SHALL) 包含：
  - ● ◉ ○ ✓ ✗ 用于状态
  - ──▶ 用于指示
  - 🖼 🎬 用于媒体类型（如终端支持）