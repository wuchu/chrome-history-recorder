## 1. 组件重构 - 导入 antd 组件

- [x] 1.1 在 `ClassifyProgressSection.tsx` 中导入 `Progress`、`Button`、`Tooltip` 从 antd
- [x] 1.2 导入需要的图标：`RobotOutlined`、`PlayCircleOutlined`、`PauseCircleOutlined`、`ReloadOutlined`、`DeleteOutlined` 从 `@ant-design/icons`
- [x] 1.3 导入 `useTranslation` hook 用于 i18n

## 2. JSX 结构更新

- [x] 2.1 重构 JSX 为单行紧凑布局：Robot 标签 + Progress + 按钮组
- [x] 2.2 计算进度百分比：`total > 0 ? Math.round((completed / total) * 100) : 0`
- [x] 2.3 根据 `scheduler.running`、`failed > 0` 确定 Progress 的 status 和 color
- [x] 2.4 每个按钮用 `Tooltip` 包裹，提供提示文字
- [x] 2.5 根据状态条件显示/隐藏或禁用按钮

## 3. CSS 样式更新

- [x] 3.1 更新 `ClassifyProgressSection.module.css` 适应单行紧凑布局
- [x] 3.2 确保 dark mode 支持正常工作
- [x] 3.3 保持与 `StatusBar.tsx` 相似的视觉风格

## 4. 测试验证

- [x] 4.1 验证运行中状态：绿色进度条 + 动画 + 暂停按钮
- [x] 4.2 验证暂停状态：黄色/蓝色进度条 + 无动画 + 开始按钮
- [x] 4.3 验证有失败状态：红色进度条 + 重试按钮可用
- [x] 4.4 验证按钮功能：开始/暂停/重试/清空都正常工作
- [x] 4.5 验证 Tooltip 提示正常显示
