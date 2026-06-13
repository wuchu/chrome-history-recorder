## 1. 创建插件模块结构

- [ ] 1.1 创建 packages/proxy/src/plugins/ 目录
- [ ] 1.2 创建 plugins/types.ts 定义插件接口类型
- [ ] 1.3 创建 plugins/plugin-api.ts 导出 ProxyPlugin 接口
- [ ] 1.4 创建 plugins/context.ts 实现 PluginContext

## 2. 实现插件发现机制

- [ ] 2.1 创建 plugins/discovery.ts
- [ ] 2.2 实现 discoverPlugins() 扫描本地 plugins/ 目录
- [ ] 2.3 实现 discoverPlugins() 扫描 npm 包 @proxy-plugin/*
- [ ] 2.4 实现 PluginInfo 类型返回
- [ ] 2.5 测试插件发现功能

## 3. 实现插件管理器

- [ ] 3.1 创建 plugins/manager.ts
- [ ] 3.2 实现 PluginManager 类
- [ ] 3.3 实现 loadAll() 方法按优先级加载插件
- [ ] 3.4 实现 loadPlugin() 方法加载单个插件
- [ ] 3.5 实现 executeHook() 方法执行所有插件的钩子
- [ ] 3.6 实现 getPluginStatus() 方法获取插件状态
- [ ] 3.7 实现 unloadAll() 方法卸载所有插件

## 4. 实现钩子系统

- [ ] 4.1 创建 plugins/hooks.ts
- [ ] 4.2 实现 HookRegistry 注册钩子
- [ ] 4.3 实现 afterSave 钩子执行
- [ ] 4.4 实现 beforeDelete 钩子执行（支持返回 false 阻止）
- [ ] 4.5 实现 beforeList 和 afterList 钩子（可选）
- [ ] 4.6 实现钩子错误隔离（不影响主服务）

## 5. 实现路由扩展

- [ ] 5.1 实现 registerRoute() 方法注册插件路由
- [ ] 5.2 实现路由命名空间建议
- [ ] 5.3 实现路由错误隔离
- [ ] 5.4 在启动信息中显示插件路由

## 6. 实现插件配置

- [ ] 6.1 创建 config/proxy-config.yaml 配置文件结构
- [ ] 6.2 实现读取 plugins 配置字段
- [ ] 6.3 实现插件 enabled 字段控制
- [ ] 6.4 实现插件 priority 字段排序
- [ ] 6.5 实现插件 config 字段传递

## 7. 改造 Proxy Server

- [ ] 7.1 在 server.ts 中导入 PluginManager
- [ ] 7.2 在启动时调用 pluginManager.loadAll()
- [ ] 7.3 在 /save-image 端点后执行 afterSave 钩子
- [ ] 7.4 在 /images/:hash DELETE 端点前执行 beforeDelete 钩子
- [ ] 7.5 注册 GET /plugins 状态 API
- [ ] 7.6 注册 GET /plugins/:name/status 状态 API
- [ ] 7.7 在启动输出中显示插件加载状态

## 8. 创建插件启动画面

- [ ] 8.1 在 Proxy 启动输出中显示 "PLUGINS" 面板
- [ ] 8.2 显示每个插件的加载状态（● running / ○ disabled / ✗ failed）
- [ ] 8.3 显示插件注册的 hooks 和 routes
- [ ] 8.4 显示插件服务的连接状态（如 Ollama）

## 9. 创建示例插件骨架

- [ ] 9.1 创建 plugins/_example/ 示例插件目录
- [ ] 9.2 创建 plugin.ts 示例插件实现
- [ ] 9.3 示例包含所有钩子和路由定义
- [ ] 9.4 作为其他插件开发的参考

## 10. 测试和验证

- [ ] 10.1 测试无插件时 Proxy 正常运行
- [ ] 10.2 测试插件 enabled=false 时不加载
- [ ] 10.3 测试插件优先级排序
- [ ] 10.4 测试 afterSave 钩子执行
- [ ] 10.5 测试钩子错误隔离
- [ ] 10.6 测试插件状态 API
- [ ] 10.7 测试插件路由注册

## 11. 文档更新

- [ ] 11.1 更新 packages/proxy/README.md 说明插件系统
- [ ] 11.2 创建 PLUGINS.md 插件开发指南
- [ ] 11.3 说明插件接口和生命周期
- [ ] 11.4 说明钩子和路由注册
- [ ] 11.5 提供示例插件代码