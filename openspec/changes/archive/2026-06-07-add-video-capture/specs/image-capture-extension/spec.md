## MODIFIED Requirements

### Requirement: DevTools 面板集成
扩展必须 (SHALL) 在 Chrome DevTools 中提供专用的控制面板，支持图片和视频捕获。

#### Scenario: 创建 DevTools 面板
- **WHEN** 用户打开 DevTools
- **THEN** 扩展必须 (SHALL) 在 DevTools 中创建一个名为 "Image Recorder" 的面板

#### Scenario: 面板显示捕获状态
- **WHEN** DevTools 面板打开
- **THEN** 面板必须 (SHALL) 显示当前会话捕获的图片和视频列表及统计信息

**统计信息内容**:
- **当前标签页统计**:
  - 捕获图片数量（成功）
  - 捕获视频数量（成功）
  - 跳过数量（因过滤规则）
  - 失败数量（传输错误）
  - 总文件大小（已捕获媒体）
- **全局统计**（所有标签页汇总）:
  - 总捕获数量
  - 总文件大小

#### Scenario: 面板提供配置选项
- **WHEN** 用户在面板中修改配置
- **THEN** 面板必须 (SHALL) 提供代理端点、过滤规则、开关等配置选项
- **AND** 面板必须 (SHALL) 提供视频类型过滤配置

## ADDED Requirements

### Requirement: 视频捕获开关
扩展必须 (SHALL) 在 DevTools 面板中允许用户独立控制视频捕获。

#### Scenario: 独立视频捕获开关
- **WHEN** 用户在面板点击视频捕获切换按钮
- **THEN** 扩展必须 (SHALL) 启用或禁用当前页面的视频捕获功能
- **AND** 视频捕获开关与图片捕获开关独立控制

#### Scenario: 显示视频捕获状态
- **WHEN** 视频捕获处于活动状态
- **THEN** DevTools 面板必须 (SHALL) 显示视频捕获状态和实时计数