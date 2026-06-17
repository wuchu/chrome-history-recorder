## 1. Dependencies

- [x] 1.1 安装 @ant-design/icons 依赖到 extension package.json

## 2. StatusBar Component

- [x] 2.1 修改 StatusBar.tsx，添加新的 props 接口（onOpenOptions、onClearEvents）
- [x] 2.2 修改 StatusBar.tsx，引入 Ant Design icons 和 Tooltip 组件
- [x] 2.3 修改 StatusBar.tsx，将捕获按钮改为使用 PlayCircleOutlined/PauseCircleOutlined 图标
- [x] 2.4 修改 StatusBar.tsx，添加清空事件按钮（ClearOutlined）
- [x] 2.5 修改 StatusBar.tsx，添加设置按钮（SettingOutlined）
- [x] 2.6 为所有图标按钮添加 Tooltip
- [x] 2.7 更新 StatusBar.module.css，添加右侧图标按钮区域样式

## 3. App Component

- [x] 3.1 修改 App.tsx，将 handleOpenOptions 和 handleClearEvents 传递给 StatusBar
- [x] 3.2 修改 App.tsx，从 sidepanel-toolbar 移除 Settings 和 Clear Events 按钮
- [x] 3.3 更新 sidepanel.css，简化 sidepanel-toolbar 样式 (已有样式足够简洁)

## 4. Verification

- [x] 4.1 运行 TypeScript 编译检查 (现有错误与本次修改无关)
- [x] 4.2 手动测试所有按钮功能正常
- [x] 4.3 验证 tooltip 显示正常
