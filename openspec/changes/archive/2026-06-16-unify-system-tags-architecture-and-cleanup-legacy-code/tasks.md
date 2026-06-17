## 1. 后端 - 保存文件时添加系统标签

- [x] 1.1 修改 vfs-service/src/api.ts 中的 saveFile()，根据 mime_type 添加 "system:image" 或 "system:video" 标签
- [x] 1.2 修改 vfs-service/src/api.ts 中的 syncBlobsToIndex()，为已存在的文件添加系统标签

## 2. 后端 - 简化查询逻辑

- [x] 2.1 简化 vfs-service/src/sqlite.ts 中的 listFiles()，移除对 "image"、"video"、"starred"、"uncategorized" 的特殊 case，统一查询 tags 字段
- [x] 2.2 注意：仍需处理 "all" 标签（无过滤）

## 3. 后端 - 简化统计逻辑

- [x] 3.1 简化 vfs-service/src/sqlite.ts 中的 getTagCounts()，移除对 mime_type、is_starred 等字段的特殊检查，统一从 tags 字段统计

## 4. 删除死代码

- [x] 4.1 删除 extension/src/entrypoints/media-browser/components/MediaTabs.tsx
- [x] 4.2 删除 extension/src/entrypoints/media-browser/components/MediaTabs.module.css

## 5. 验证与测试

- [x] 5.1 运行 build 确保无错误
- [x] 5.2 运行 tests 确保所有测试通过
