## Context

当前 Prompt 要求输出复杂 JSON 格式，小模型 (Gemma 3 4B) 难以稳定输出。实际需求仅为分类 + 文件名，不需要复杂的 JSON 结构。

## Goals / Non-Goals

**Goals:**
- 简化 Prompt，提高小模型输出稳定性
- 多重解析 fallback，提高成功率
- 文件名始终英文，确保文件系统兼容
- 保留 language 配置功能

**Non-Goals:**
- 不改变 API 调用方式
- 不改变分类/命名的核心逻辑
- 不增加新的配置项

## Decisions

### Prompt 格式

使用管道分隔符格式，替代 JSON：

```
中文版:
"识别这张图片。
 输出格式: 分类 | 文件名
 分类用一个词，文件名用英文（不含扩展名）。
 示例: 猫咪 | cute_kitty"

英文版:
"Identify this image.
 Output format: CATEGORY | FILENAME
 One word category. English filename (no extension).
 Example: cat | cute_kitty"
```

**为什么不用 JSON:**
- 小模型输出 JSON 不稳定
- 管道分隔更简单，解析更可靠
- 示例格式让模型更容易跟随

### 解析 Fallback 顺序

```
1. 管道分隔 "cat | kitty" → split('|')
2. 空格分隔 "cat kitty" → split(/\s+/)
3. JSON 兜底 "{...}" → regex + parse
4. 全失败 → 用原文件名 + unknown
```

### 文件名清理规则

```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w\-]/g, '_')  // 只保留字母数字下划线
    .replace(/_+/g, '_')       // 合并多余下划线
    .toLowerCase()
    .slice(0, 30);             // 长度限制
}
```

### Language 配置保留

- 中文 Prompt：分类可以是中文，文件名仍要求英文
- 英文 Prompt：分类和文件名都是英文
- 文件名始终英文，确保跨平台兼容