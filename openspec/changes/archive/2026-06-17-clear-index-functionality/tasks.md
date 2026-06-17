## 1. VFS Service - SQLite 层

- [x] 1.1 在 `SQLiteDatabase` 类中添加 `clearIndex()` 方法
- [x] 1.2 实现方法：在事务中执行 `DELETE FROM classify_queue` 和 `DELETE FROM files`
- [x] 1.3 确保方法返回成功状态

## 2. VFS Service - API 层

- [x] 2.1 在 `VFSAPI` 类中添加 `clearIndex()` 方法
- [x] 2.2 实现方法：调用 `SQLiteDatabase.clearIndex()`
- [x] 2.3 返回 `{ success: boolean }` 格式

## 3. VFS Service - Dispatcher 层

- [x] 3.1 在 `dispatchMethod()` 函数中添加 `case 'clearIndex':`
- [x] 3.2 路由到 `api.clearIndex()`

## 4. Extension - VFS WebSocket Client

- [x] 4.1 在 `VFSWebSocketClient` 类中添加 `clearIndex()` 方法
- [x] 4.2 实现方法：调用 `this.send('clearIndex')`
- [x] 4.3 返回 `Promise<{ success: boolean }>`

## 5. Extension - Runtime 层

- [x] 5.1 在 `extension-runtime.ts` 中添加 `clearIndex()` 函数
- [x] 5.2 实现函数：通过 `sendRuntimeMessage()` 发送 `{ type: 'clearIndex' }`

## 6. Extension - Background

- [x] 6.1 在 background 的 `onMessage` listener 中添加 `case 'clearIndex':`
- [x] 6.2 实现：调用 `getVFSWebSocketClient().clearIndex()`
- [x] 6.3 返回结果给调用方

## 7. Extension - Options Hook

- [x] 7.1 在 `useOptionsData.ts` 中添加 `clearIndex()` 函数
- [x] 7.2 添加 `saving.clearIndex` 状态
- [x] 7.3 实现函数：调用 `clearIndex()` 并处理 loading 状态

## 8. Extension - Options UI

- [x] 8.1 在 `App.tsx` 的"媒体索引维护"卡片中添加"清空索引"按钮
- [x] 8.2 使用 `Popconfirm` 组件添加二次确认
- [x] 8.3 配置确认文案：Title "清空索引"，Description "确定要清空所有索引吗？物理文件不会被删除，你可以随后重新同步。"
- [x] 8.4 按钮样式：使用 `danger` 类型（红色）以示区别
- [x] 8.5 显示 loading 状态（`saving.clearIndex`）
- [x] 8.6 成功后显示 message 提示
- [x] 8.7 确保按钮在 VFS 未连接时禁用

## 9. 测试验证

- [ ] 9.1 测试点击"清空索引"按钮弹出确认对话框
- [ ] 9.2 测试取消操作不会清空
- [ ] 9.3 测试确认后索引被清空
- [ ] 9.4 测试清空后物理文件仍然存在
- [ ] 9.5 测试清空后可以手动点击"同步"重新建立索引
- [ ] 9.6 测试 VFS 未连接时按钮禁用
