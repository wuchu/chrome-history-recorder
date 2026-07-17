## Context

当前 WXT 配置中，`webExt` 没有设置 Chrome profile，每次启动 `pnpm dev` 都会使用临时 profile：

```typescript
// 当前 wxt.config.ts
webExt: process.env.NO_BROWSER
  ? { disabled: true }
  : {
      chromiumArgs: ['https://www.baidu.com'],
    },
```

WXT 的 `WebExtConfig` 类型支持以下相关配置：
- `chromiumProfile`: Chrome profile 目录路径
- `keepProfileChanges`: 是否保留 profile 变更（默认 false）

**用户期望**：
- 首次手动登录 Google 账号
- 之后启动开发服务器自动保持登录状态
- profile 数据保存在项目本地，不影响日常使用的 Chrome
- 可以随时重置测试环境（删除 profile 目录）

## Goals / Non-Goals

**Goals:**
- 配置使用项目本地 Chrome profile 目录（`.chrome-dev-profile/`）
- 启用 `keepProfileChanges: true` 持久化变更
- 更新 `.gitignore` 忽略 profile 目录
- 支持通过环境变量 `CHROME_PROFILE_PATH` 覆盖默认路径
- 不影响现有 `pnpm dev` 和 `pnpm dev:no-browser` 行为

**Non-Goals:**
- 不自动登录 Google 账号（仍需手动登录一次）
- 不修改 WXT 框架本身
- 不支持 profile 同步或备份
- 不在生产构建中使用此配置

## Decisions

### 1. Profile 目录位置：项目根目录

**方案**：
```typescript
import path from 'path';

// 在项目根目录下创建 .chrome-dev-profile
const LOCAL_CHROME_PROFILE = path.resolve(process.cwd(), '.chrome-dev-profile');
```

**目录结构**：
```
项目根目录/
├── .chrome-dev-profile/    ← Chrome profile 放在这里
├── packages/
│   ├── extension/
│   │   └── wxt.config.ts
│   └── vfs-service/
└── .gitignore
```

**理由**：
- profile 与项目绑定，每个项目独立
- 便于管理和重置（直接删除目录即可）
- 路径简单明确

### 2. 环境变量覆盖支持

**方案**：
```typescript
webExt: process.env.NO_BROWSER
  ? { disabled: true }
  : {
      chromiumArgs: ['https://www.baidu.com'],
      chromiumProfile: process.env.CHROME_PROFILE_PATH || LOCAL_CHROME_PROFILE,
      keepProfileChanges: true,
    },
```

**理由**：
- 灵活性：用户可以指定自己的 profile 路径
- 向后兼容：不设置环境变量时使用默认路径
- 便于团队成员根据需要调整

### 3. Git 忽略：添加 .chrome-dev-profile/

**方案**：
在 `.gitignore` 中添加：
```
# Chrome Dev Profile
.chrome-dev-profile/
```

**理由**：
- profile 包含个人登录信息，不应提交到仓库
- profile 目录可能很大，避免污染 Git 历史

### 4. 不创建 specs（功能简单无需 spec）

**理由**：
- 这是一个开发体验改进，不涉及用户功能
- 没有复杂的业务逻辑需要规格说明
- 配置变更简单直接

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| profile 目录过大 | 可以随时删除目录重置，已添加到 .gitignore |
| 跨平台路径问题 | 使用 `path.resolve()` 自动处理路径分隔符 |
| Chrome 锁定 profile | 如果 Chrome 正在运行该 profile，可能需要先关闭 |
| 误删除 profile | 这是预期的重置方式，重新登录即可 |
