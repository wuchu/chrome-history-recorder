## Why

项目中不再需要 `chrome-dev-profile` 配置：

1. **开发流程简化**：每次开发不一定需要持久化登录状态
2. **目录清理**：`.chrome-dev-profile/` 目录占用空间且容易被遗忘
3. **配置简化**：减少不必要的配置项，降低维护成本
4. **避免冲突**：避免与其他开发工具或 Chrome 实例的 profile 冲突

当前配置强制使用本地 profile，而实际上大多数场景下使用默认临时 profile 已经足够。

## What Changes

- 移除 `packages/extension/wxt.config.ts` 中的 `LOCAL_CHROME_PROFILE` 常量
- 移除 `webExt.chromiumProfile` 配置
- 移除 `webExt.keepProfileChanges` 配置（或设为 false）
- 删除项目根目录下的 `.chrome-dev-profile/` 目录
- 可选：移除 `.gitignore` 中的 `.chrome-dev-profile/` 忽略规则
- 保留环境变量支持（可选，供有需要的用户使用）

## Capabilities

### Modified Capabilities
- `dev-mode`: 简化开发模式配置，使用 WXT 默认的临时 Chrome profile

## Impact

- 修改 `packages/extension/wxt.config.ts` 移除 profile 配置
- 删除 `.chrome-dev-profile/` 目录
- 不影响现有功能和生产构建
- 向后兼容：仍可通过环境变量 `CHROME_PROFILE_PATH` 指定自定义 profile（可选保留）
