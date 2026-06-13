# Enhance CLI Experience

## Summary

将 AI Classify CLI 从简单输出升级为炫酷的终端 UI，使用 ASCII Art Logo、彩色边框面板、实时进度条和动画效果，提升技术用户的体验。

## Motivation

当前 CLI 输出过于简单，缺乏视觉吸引力：
- 启动时只显示一行 "AI Classify started"
- 处理过程只有简单的文本输出
- 没有进度可视化
- 配置向导缺乏智能检测

作为面向技术用户的工具，CLI 是主要交互界面，需要人性化和炫酷的体验。

## Goals

1. **启动画面** - ASCII Art Logo + 配置摘要面板 + 服务连接状态
2. **进度可视化** - 队列状态条 + 总体进度条 + 当前任务列表
3. **分类结果** - 美观的卡片展示 + 置信度可视化
4. **运行时交互** - 键盘快捷键控制暂停/停止/重试
5. **智能配置向导** - 自动检测目录、端点、模型

## Non-goals

- 不实现 GUI 界面（CLI 是核心形态）
- 不支持所有终端（主要支持现代终端如 iTerm2、VSCode、Terminal.app）
- 不实现终端图片预览（作为可选增强）

## Scope

- **Module**: `packages/ai-classify`
- **Affected files**: `cli.ts`, 新增 `ui/` 目录

## Related Specs

- [cli-experience](../../specs/cli-experience/spec.md)

## Risks

- 终端兼容性问题（不同终端对 ANSI 颜色/Unicode 支持不同）
- 性能影响（频繁更新进度条可能影响处理速度）

## Success Criteria

- 启动画面显示美观的 Logo 和配置面板
- 处理过程有实时进度可视化
- 用户可以通过键盘控制处理流程
- 配置向导能智能检测可用选项