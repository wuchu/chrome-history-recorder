# Proxy Plugin System

## Summary

为 Proxy 服务添加标准化的插件系统，支持第三方扩展功能，实现自动发现、加载、配置和状态管理。

## Motivation

当前 Proxy 是独立的媒体存储服务，功能固定。AI Classify 是独立 CLI 工具，两者之间没有集成。

用户需要：
- Proxy 启动时自动加载 AI Classify 作为后台分类服务
- Extension 可以通过 Proxy API 获取分类状态和结果
- 未来可以添加更多扩展（OCR、云同步、压缩等）

## Goals

1. **插件接口定义** - 标准化的 ProxyPlugin 接口
2. **文件处理钩子** - afterSave、beforeDelete 等钩子点
3. **API 路由扩展** - 插件可注册自定义 HTTP 路由
4. **插件发现机制** - 自动扫描本地目录和 npm 包
5. **插件配置** - proxy-config.yaml 支持插件配置
6. **插件状态 API** - 查询插件状态的 HTTP API

## Non-goals

- 不实现插件市场或远程下载
- 不实现插件间的依赖管理（可选增强）
- 不实现插件的热更新（需要重启 Proxy）

## Scope

- **Module**: `packages/proxy`
- **Affected files**: `server.ts`, 新增 `plugins/` 目录，新增 `plugin-api.ts`

## Related Specs

- [proxy-plugin-system](../../specs/proxy-plugin-system/spec.md)

## Risks

- 插件错误可能影响主服务稳定性（需要隔离）
- 插件加载顺序可能影响功能（需要明确的优先级）

## Success Criteria

- Proxy 启动时自动发现并加载 plugins/ 目录中的插件
- 插件可以注册 afterSave 钩子处理新保存的文件
- 插件可以注册自定义 HTTP 路由
- GET /plugins API 返回所有插件状态
- 插件错误不影响主 Proxy 服务运行