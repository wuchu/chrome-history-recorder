## 1. StatusBar 组件重构

- [x] 1.1 更新 StatusBar Props 接口，新增 captureCount、failedCount、captureError
- [x] 1.2 精简状态文案："服务"、"VFS"、"Ollama"
- [x] 1.3 实现捕获统计显示：✅N 和 ❌N 图标
- [x] 1.4 添加竖线 | 分隔不同信息区域
- [x] 1.5 给 ❌ 图标添加 Tooltip 显示错误信息

## 2. StatusBar 样式调整

- [x] 2.1 压缩 padding 和间距，使布局更紧凑
- [x] 2.2 添加分隔符样式
- [x] 2.3 调整图标和文字的对齐方式

## 3. Side Panel App 整合

- [x] 3.1 从 sidepanel/App.tsx 移除 sidepanel-toolbar
- [x] 3.2 将 captureCount、failedCount、captureError 传递给 StatusBar
- [x] 3.3 移除 sidepanel.css 中 sidepanel-toolbar 相关样式

## 4. 测试验证

- [x] 4.1 验证状态显示正常
- [x] 4.2 验证捕获统计显示正确
- [x] 4.3 验证错误 Tooltip 工作正常
- [x] 4.4 验证整体布局更紧凑
