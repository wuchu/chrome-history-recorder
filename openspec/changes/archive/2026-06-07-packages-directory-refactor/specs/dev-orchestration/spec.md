## ADDED Requirements

### Requirement: 一键启动开发环境
项目必须 (SHALL) 支持通过根目录的单个命令启动所有开发服务。

#### Scenario: 启动所有服务
- **WHEN** 用户在根目录运行 `npm run dev`
- **THEN** 系统 必须 (SHALL) 同时启动 extension 和 proxy 服务
- **AND** 所有服务的日志必须 (SHALL) 输出到同一终端

#### Scenario: 服务并发启动
- **WHEN** 多个服务启动命令被执行
- **THEN** 服务 必须 (SHALL) 并发启动而非串行
- **AND** 任一服务启动失败 必须 (SHALL) 显示错误信息但不中断其他服务

#### Scenario: 进程管理
- **WHEN** 用户按下 Ctrl+C
- **THEN** 所有正在运行的服务 必须 (SHALL) 同时停止
- **AND** 系统 必须 (SHALL) 确保所有子进程被正确终止

### Requirement: Monorepo 目录结构
项目必须 (SHALL) 使用标准的 monorepo 目录结构组织各个包。

#### Scenario: 目录结构规范
- **WHEN** 项目目录结构被检查
- **THEN** 所有包 必须 (SHALL) 位于 `packages/` 目录下
- **AND** 根目录 必须 (SHALL) 只包含配置文件和顶层脚本

#### Scenario: Workspace 配置正确
- **WHEN** pnpm 读取 `pnpm-workspace.yaml`
- **THEN** 配置 必须 (SHALL) 正确指向 `packages/*` 目录
- **AND** pnpm 必须 (SHALL) 能正确解析包间依赖

### Requirement: Git 历史保留
目录重构必须 (SHALL) 保留所有文件的 Git 提交历史。

#### Scenario: 文件移动追踪
- **WHEN** 文件从根目录移动到 packages/ 目录
- **THEN** Git 必须 (SHALL) 追踪文件移动而非删除/新增
- **AND** 文件历史 必须 (SHALL) 可通过 `git log` 查看

#### Scenario: 提交历史可追溯
- **WHEN** 用户查看任意文件的提交历史
- **THEN** 系统 必须 (SHALL) 显示移动前的提交记录
- **AND** 移动操作的提交 必须 (SHALL) 标记为文件移动