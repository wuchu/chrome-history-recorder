## ADDED Requirements

### Requirement: 无浏览器启动的开发模式
开发命令必须 (SHALL) 支持不自动启动浏览器的调试模式。

#### Scenario: 启动无浏览器模式
- **WHEN** 用户运行 `pnpm dev:no-browser`
- **THEN** 开发服务器必须 (SHALL) 正常启动并构建扩展
- **AND** 浏览器必须 (SHALL) 不自动打开

#### Scenario: 热更新正常工作
- **WHEN** 在无浏览器模式下修改代码
- **THEN** WXT 必须 (SHALL) 正常触发热更新
- **AND** 已手动加载的扩展必须 (SHALL) 自动刷新

### Requirement: 友好的调试提示
控制台必须 (SHALL) 输出清晰的调试指导信息。

#### Scenario: 输出扩展目录路径
- **WHEN** 开发服务器启动完成
- **THEN** 控制台必须 (SHALL) 显示扩展目录的绝对路径
- **AND** 路径必须 (SHALL) 使用平台标准格式

#### Scenario: 输出操作步骤
- **WHEN** 开发服务器启动完成
- **THEN** 控制台必须 (SHALL) 显示手动加载扩展的步骤：
  1. 打开 Chrome
  2. 访问 chrome://extensions/
  3. 开启开发者模式
  4. 加载已解压的扩展程序
  5. 选择扩展目录

#### Scenario: 多语言支持
- **WHEN** 系统语言为中文
- **THEN** 提示信息 必须 (SHALL) 使用中文
- **WHEN** 系统语言为英文或其他
- **THEN** 提示信息 必须 (SHALL) 使用英文

#### Scenario: 提示格式清晰
- **WHEN** 输出提示信息
- **THEN** 提示 必须 (SHALL) 使用分隔线和颜色区分
- **AND** 关键信息 必须 (SHALL) 使用醒目颜色（如绿色、黄色）