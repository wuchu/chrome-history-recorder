# 技术术语对照表

本文档用于确保 OpenSpec 文档翻译的一致性。所有翻译人员应遵循此对照表。

## 核心概念术语

| 英文术语 | 中文翻译 | 首次出现格式 | 使用说明 |
|---------|---------|------------|---------|
| proposal | 提案 | proposal (提案) | 表示变更提案文档 |
| design | 设计 | design (设计) | 表示技术设计文档 |
| tasks | 任务 | tasks (任务) | 表示实施任务清单 |
| spec | 规范 | spec (规范) | 表示详细规范文档 |
| capability | 能力 | capability (能力) | 表示系统能力或功能模块 |
| schema | 模式 | schema (模式) | 表示工作流模式 |
| artifact | 文档产物 | artifact (文档产物) | 表示规划阶段的文档产物 |

## 技术实现术语

| 英文术语 | 中文翻译 | 首次出现格式 | 使用说明 |
|---------|---------|------------|---------|
| browser extension | 浏览器扩展 | browser extension (浏览器扩展) | 表示浏览器插件 |
| content script | 内容脚本 | content script (内容脚本) | 表示在网页中运行的脚本 |
| background service worker | 后台服务工作线程 | background service worker (后台服务工作线程) | 表示后台运行的脚本 |
| local proxy service | 本地代理服务 | local proxy service (本地代理服务) | 表示本地HTTP服务器 |
| content hash | 内容哈希 | content hash (内容哈希) | 表示基于内容的哈希值 |
| filesystem | 文件系统 | filesystem (文件系统) | 表示本地文件系统 |

## OpenSpec 相关术语

| 英文术语 | 中文翻译 | 馳次出现格式 | 使用说明 |
|---------|---------|------------|---------|
| planning home | 规划主目录 | planning home (规划主目录) | 表示规划文档的根目录 |
| change root | 变更根目录 | change root (变更根目录) | 表示特定变更的目录 |
| delta spec | 变量规范 | delta spec (增量规范) | 表示修改现有规范的文档 |
| apply phase | 实施阶段 | apply phase (实施阶段) | 表示执行任务的阶段 |

## 文档操作术语

| 英文术语 | 中文翻译 | 馳次出现格式 | 使用说明 |
|---------|---------|------------|---------|
| requirement | 需求 | requirement (需求) | 表示系统需求 |
| scenario | 场景 | scenario (场景) | 表示测试场景 |
| migration | 迁移 | migration (迁移) | 表示迁移步骤 |

## 翻译规则

1. **首次出现**: 使用格式 "英文术语 (中文翻译)"
2. **后续出现**: 可以使用中文翻译或保留英文术语
3. **专业性**: 技术术语优先保留英文，配合中文注释
4. **一致性**: 同一术语在所有文档中翻译必须一致

## 注意事项

- 不要翻译文件名、路径、命令名称
- 代码片段和命令行示例保持英文
- URL 和链接保持原文
- 技术参数名称保持英文（如 `manifest.json`）

---

**更新日期**: 2026-06-06
**变更**: translate-documents-to-chinese