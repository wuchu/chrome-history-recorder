## MODIFIED Requirements

### Requirement: 任务队列启动处理
系统 必须 (SHALL) 在启动时自动扫描并处理 input 目录下的现有文件。

#### Scenario: 启动时扫描现有文件
- **WHEN** 用户运行 `ai-classify start`
- **THEN** 系统 必须 (SHALL) 扫描 input 目录下的所有文件
- **AND** 系统 必须 (SHALL) 将未处理的文件加入任务队列
- **AND** 系统 必须 (SHALL) 跳过已处理过的文件（基于 hash index）

#### Scenario: 启动后开始监控
- **WHEN** 现有文件扫描并入队完成
- **THEN** 系统 必须 (SHALL) 开始监控 input 目录的变更
- **AND** 新增或修改的文件 必须 (SHALL) 自动加入队列