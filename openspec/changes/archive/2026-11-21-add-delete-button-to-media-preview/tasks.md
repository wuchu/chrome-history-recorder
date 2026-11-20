## 1. 国际化文本

- [x] 1.1 在 `locales/en.json` 添加删除相关文本
- [x] 1.2 在 `locales/zh.json` 添加删除相关文本

## 2. useCombinedMedia 更新

- [x] 2.1 在 `useCombinedMedia.ts` 中添加 `file:deleted` 事件提取函数
- [x] 2.2 过滤掉已删除的项目

## 3. MasonryItem 删除按钮

- [x] 3.1 在 `MasonryItem.tsx` 添加删除按钮 UI
- [x] 3.2 在 `MasonryItem.module.css` 添加删除按钮样式（悬停显示）
- [x] 3.3 实现删除点击事件处理（阻止冒泡 + confirm 确认）

## 4. MediaDetail 删除按钮

- [x] 4.1 在 `MediaDetail.tsx` 工具栏添加删除按钮
- [x] 4.2 在 `MediaDetail.module.css` 添加删除按钮样式
- [x] 4.3 实现删除点击事件处理（confirm 确认 + 关闭详情）

## 5. 集成测试

- [x] 5.1 测试从缩略图删除功能
- [x] 5.2 测试从详情页删除功能
- [x] 5.3 测试深色/浅色主题适配
