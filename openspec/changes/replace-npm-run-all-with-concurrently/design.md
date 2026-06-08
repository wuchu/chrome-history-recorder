## Context

当前使用 npm-run-all 并行运行多个 dev 脚本。替换为 concurrently 以获得更好的输出格式。

## Goals / Non-Goals

**Goals:**
- 使用 concurrently 替换 npm-run-all
- 保留相同的功能：并行运行 dev 脚本
- 改善日志输出可读性

**Non-Goals:**
- 不改变 dev 脚本的功能行为
- 不添加新的脚本命令

## Decisions

### concurrently 配置

使用默认配置，不需要自定义前缀名称或颜色。

**脚本语法:**
```json
"dev": "concurrently \"pnpm dev:extension\" \"pnpm dev:proxy\""
```

不使用 `-n` (自定义名称) 和 `-c` (自定义颜色) 选项，保持简洁。

### kill-others 选项

不使用 `-k` (kill-others) 选项。当前 npm-run-all 也没有这个行为，保持一致。