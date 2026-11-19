## Context

当前 `packages/extension/wxt.config.ts` 中的配置：

```typescript
// Local Chrome profile for development - persists login state
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_CHROME_PROFILE = path.resolve(__dirname, '../..', '.chrome-dev-profile');

// 浏览器启动配置
webExt: process.env.NO_BROWSER
  ? {
      disabled: true,
    }
  : {
      chromiumArgs: ['https://www.baidu.com'],
      chromiumProfile: process.env.CHROME_PROFILE_PATH || LOCAL_CHROME_PROFILE,
      keepProfileChanges: true,
    },
```

## Goals / Non-Goals

**Goals:**
- 移除硬编码的 `.chrome-dev-profile` 路径配置
- 删除物理目录 `.chrome-dev-profile/`
- 简化 `wxt.config.ts` 配置
- 可选：保留 `CHROME_PROFILE_PATH` 环境变量支持（供有需要的用户）

**Non-Goals:**
- 不改变 `pnpm dev:no-browser` 的行为
- 不影响生产构建
- 不移除 `chromiumArgs` 配置

## Decisions

### 1. 简化方案：完全移除本地 profile 配置

**方案**：
```typescript
webExt: process.env.NO_BROWSER
  ? {
      disabled: true,
    }
  : {
      chromiumArgs: ['https://www.baidu.com'],
      // 移除 chromiumProfile 和 keepProfileChanges
    },
```

**理由**：
- 简单直接，回归 WXT 默认行为
- 大多数开发场景不需要持久化 profile
- 需要持久化的用户可以手动通过 Chrome 扩展页面加载

### 2. 折中方案：保留环境变量支持

**备选方案**（如果用户希望保留灵活性）：
```typescript
webExt: process.env.NO_BROWSER
  ? {
      disabled: true,
    }
  : {
      chromiumArgs: ['https://www.baidu.com'],
      ...(process.env.CHROME_PROFILE_PATH && {
        chromiumProfile: process.env.CHROME_PROFILE_PATH,
        keepProfileChanges: true,
      }),
    },
```

**决策**：采用**折中方案**，保留环境变量支持但移除默认本地 profile。这样既简化了默认配置，又给有需要的用户留下了灵活性。

### 3. 删除物理目录

**方案**：
- 删除项目根目录下的 `.chrome-dev-profile/` 目录

**理由**：
- 目录不再被使用
- 释放磁盘空间
- 保持项目目录整洁

### 4. Gitignore：可选保留或移除

**方案**：
- 保留 `.gitignore` 中的规则（推荐），以防未来有人重新使用
- 或者移除规则，保持 gitignore 简洁

**决策**：保留 `.gitignore` 规则，作为预防性措施。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 用户需要重新登录 | 使用环境变量 `CHROME_PROFILE_PATH` 可恢复原有功能 |
| 开发体验下降 | 这是预期的简化，有需要的用户可自行配置 |
| 误删 profile 数据 | 确认用户意图后再执行删除 |
