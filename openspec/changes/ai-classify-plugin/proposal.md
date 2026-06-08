# AI Classify Plugin

## Summary

将 AI Classify CLI 改造为 Proxy 插件，使其可以作为 Proxy 的后台服务运行，自动处理新捕获的媒体文件，并通过 Proxy API 提供分类状态和结果。

## Motivation

当前 AI Classify 是独立 CLI 工具，用户需要手动启动。通过插件化：
- Proxy 启动时自动启动分类服务
- Extension 可通过 Proxy API 实时获取分类进度和结果
- 保持 CLI 独立形态，同时支持插件模式

## Goals

1. **插件模式支持** - AI Classify 可作为 Proxy 插件加载
2. **自动分类队列** - 新文件保存后自动加入分类队列
3. **状态 API** - 通过 Proxy API 提供分类状态和结果
4. **WebSocket 事件** - 推送分类进度事件
5. **保持 CLI 独立** - 同时支持独立 CLI 运行和插件运行

## Non-goals

- 不改变 AI Classify 的核心分类逻辑
- 不实现多实例运行（单插件实例）

## Scope

- **Module**: `packages/ai-classify` + `packages/proxy/plugins/ai-classify`
- **Affected files**: `index.ts`, 新增 `plugin.ts`

## Dependencies

- 依赖 `proxy-plugin-system` 变更完成后实施

## Risks

- 插件模式和 CLI 模式共享核心逻辑需要良好抽象
- WebSocket 事件依赖 Proxy 的 WebSocket 服务（由 enhance-devtools-ui 实现）

## Success Criteria

- Proxy 启动时自动加载 AI Classify 插件
- 新捕获的文件自动加入分类队列
- GET /classify/status 返回分类进度
- GET /classify/results 返回分类结果列表
- POST /classify/reprocess/:hash 可重新处理指定文件
- WebSocket 推送 classify:started 和 classify:complete 事件