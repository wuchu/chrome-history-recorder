## 1. 安装 UI 相关依赖

- [x] 1.1 添加 figlet 到 ai-classify package.json
- [x] 1.2 添加 boxen 到 ai-classify package.json
- [x] 1.3 添加 chalk 到 ai-classify package.json
- [x] 1.4 添加 gradient-string 到 ai-classify package.json
- [x] 1.5 添加 cli-progress 到 ai-classify package.json
- [x] 1.6 添加 ora 到 ai-classify package.json
- [x] 1.7 添加 chalk-animation 到 ai-classify package.json
- [x] 1.8 添加 keypress 到 ai-classify package.json
- [x] 1.9 添加 log-update 到 ai-classify package.json
- [x] 1.10 (可选) 添加 terminal-image 到 ai-classify package.json
- [x] 1.11 运行 pnpm install 安装依赖

## 2. 创建 UI 模块结构

- [x] 2.1 创建 packages/ai-classify/src/ui/ 目录
- [x] 2.2 创建 ui/index.ts 导出所有 UI 模块
- [x] 2.3 创建 ui/styles.ts 定义颜色和样式常量
- [x] 2.4 创建 ui/utils.ts 定义辅助函数（truncate、formatSize 等）

## 3. 实现启动画面

- [x] 3.1 创建 ui/startup.ts
- [x] 3.2 实现 displayLogo() 函数使用 figlet 生成 ASCII Art
- [x] 3.3 实现 gradient Logo 效果（使用 gradient-string）
- [x] 3.4 实现 formatConfigPanel() 函数格式化配置摘要
- [x] 3.5 实现 displayStartup() 函数整合 Logo + 配置面板
- [x] 3.6 实现 displayServiceStatus() 显示服务连接状态
- [x] 3.7 在 cli.ts start 命令中集成启动画面

## 4. 实现进度可视化

- [x] 4.1 创建 ui/progress.ts
- [x] 4.2 实现 ProgressUI 类
- [x] 4.3 实现队列状态进度条（Pending/Processing/Completed/Failed）
- [x] 4.4 实现总体进度条
- [x] 4.5 实现 formatTaskLine() 函数格式化单个任务行
- [x] 4.6 实现 updateCurrentTasks() 显示当前任务列表
- [x] 4.7 在 AIClassify 类中集成进度 UI
- [x] 4.8 实现实时更新（使用 log-update）

## 5. 实现分类结果卡片

- [x] 5.1 创建 ui/result.ts
- [x] 5.2 实现 displayResultCard() 函数
- [x] 5.3 实现格式化置信度进度条
- [x] 5.4 实现显示 Tags 标签列表
- [x] 5.5 (可选) 实现终端图片预览（使用 terminal-image）
- [x] 5.6 在分类完成时调用 displayResultCard()

## 6. 实现键盘交互

- [x] 6.1 创建 ui/keyboard.ts
- [x] 6.2 实现 KeyboardHandler 类
- [x] 6.3 实现 P 键暂停/恢复功能
- [x] 6.4 实现 S 键停止功能
- [x] 6.5 实现 R 键重试失败功能
- [x] 6.6 实现 V 键切换详细模式
- [x] 6.7 实现 Q 键切换安静模式
- [x] 6.8 实现显示键盘提示栏
- [x] 6.9 在 start 命令中集成键盘处理

## 7. 实现智能配置向导

- [x] 7.1 创建 ui/init-wizard.ts
- [x] 7.2 实现智能目录检测和显示
- [x] 7.3 实现智能端点检测和状态显示
- [x] 7.4 实现智能模型列表获取
- [x] 7.5 改进 init 命令使用新的向导 UI
- [x] 7.6 实现配置完成后的下一步提示

## 8. 改造主 CLI 入口

- [x] 8.1 改造 cli.ts start 命令集成所有 UI 组件
- [x] 8.2 改造 cli.ts init 命令使用智能向导
- [x] 8.3 改造 cli.ts status 命令显示美观的状态面板
- [x] 8.4 实现终端兼容性检测和降级

## 9. 测试和优化

- [ ] 9.1 测试 iTerm2 下的显示效果
- [ ] 9.2 测试 VSCode Terminal 下的显示效果
- [ ] 9.3 测试 Terminal.app 下的显示效果
- [ ] 9.4 测试 Windows Terminal 下的显示效果
- [ ] 9.5 优化进度更新频率避免性能影响
- [ ] 9.6 测试键盘交互功能
- [ ] 9.7 测试长时间运行的稳定性

## 10. 文档更新

- [ ] 10.1 更新 README.md 展示新的 CLI 界面截图
- [ ] 10.2 更新 README.md 说明键盘快捷键
- [ ] 10.3 添加终端兼容性说明