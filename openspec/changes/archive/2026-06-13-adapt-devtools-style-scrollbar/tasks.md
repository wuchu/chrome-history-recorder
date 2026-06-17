## 1. 添加滚动条 CSS 变量

- [x] 1.1 在 App.module.css 的 `.panel` 选择器中添加浅色主题滚动条变量
- [x] 1.2 在 App.module.css 的 `.darkTheme` 选择器中添加深色主题滚动条变量

## 2. 实现全局滚动条样式

- [x] 2.1 在 App.module.css 中添加 `::-webkit-scrollbar` 相关样式（WebKit 浏览器）
- [x] 2.2 在 App.module.css 中添加 `scrollbar-width` 和 `scrollbar-color` 样式（Firefox）
- [x] 2.3 确保滚动条样式在主题切换时正确更新

## 3. 修改 ScrollableTabBar 组件

- [x] 3.1 从 ScrollableTabBar.module.css 中移除 `scrollbar-width: none`
- [x] 3.2 从 ScrollableTabBar.module.css 中移除 `::-webkit-scrollbar { display: none }`
- [x] 3.3 确保 ScrollableTabBar 使用全局滚动条样式

## 4. 验证和测试

- [x] 4.1 在浅色主题下测试滚动条样式
- [x] 4.2 在深色主题下测试滚动条样式
- [x] 4.3 测试 ScrollableTabBar 滚动功能正常
- [x] 4.4 测试 MediaGrid、MediaDetail 等组件的滚动条
