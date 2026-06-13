# Enhance DevTools UI

## Summary

将 DevTools 面板从简单的列表视图升级为缩略图网格界面，支持实时捕获流、历史结果浏览、搜索过滤、媒体详情面板，并通过 WebSocket 实时接收分类状态更新。

## Motivation

当前 DevTools 面板功能基础：
- 只显示文本列表，无媒体预览
- 无历史记录浏览
- 无分类状态显示
- 无搜索过滤功能

需要升级为"抓取为主，媒体管理为辅"的完整体验。

## Goals

1. **缩略图网格** - 网格式展示媒体缩略图
2. **实时捕获流** - 顶部显示最近捕获的媒体流
3. **历史结果浏览** - 分页浏览所有已分类媒体
4. **搜索过滤** - 按分类、类型、日期搜索
5. **媒体详情面板** - 点击查看大图和详细信息
6. **WebSocket 实时更新** - 接收分类状态实时推送
7. **服务状态聚合** - 显示 Proxy + AI Classify 状态

## Non-goals

- 不实现媒体编辑功能
- 不实现云同步功能
- 不实现分享功能

## Scope

- **Module**: `packages/proxy` + `packages/extension`
- **Affected files**: Proxy 缩略图 API、WebSocket 服务；Extension DevTools 面板组件

## Dependencies

- 依赖 `proxy-plugin-system` 和 `ai-classify-plugin` 变更完成后实施

## Related Specs

- [thumbnail-generation](../../specs/thumbnail-generation/spec.md)
- [websocket-events](../../specs/websocket-events/spec.md)
- [devtools-media-grid](../../specs/devtools-media-grid/spec.md)

## Risks

- 缩略图生成可能影响 Proxy 性能（需要缓存）
- WebSocket 断连需要优雅重连处理
- 大量媒体时网格渲染性能（需要虚拟化）

## Success Criteria

- DevTools 面板显示缩略图网格
- 实时捕获流显示最近 10 个媒体
- 搜索过滤功能正常工作
- 点击缩略图显示详情面板
- WebSocket 实时更新分类状态
- 服务状态正确显示 Proxy 和 AI Classify 状态