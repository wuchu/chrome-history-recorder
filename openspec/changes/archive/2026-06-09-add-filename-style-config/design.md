## Context

当前 Prompt 强制英文文件名，sanitizeFilename 只保留字母数字。用户希望：
- 中文环境 → 中文文件名
- 可配置命名风格（活泼、性感、艺术等）
- 文件名长度适中

## Goals / Non-Goals

**Goals:**
- 支持 zh-CN 输出中文文件名
- 支持 8 种预设风格 + 用户自定义
- Prompt 中约束长度，模型自控
- sanitizeFilename 放宽，允许中文

**Non-Goals:**
- 不改变分类逻辑
- 不增加新的模型调用

## Decisions

### 预设风格

```typescript
type FilenameStyle = 'auto' | 'fun' | 'sexy' | 'artistic' | 'poetic' | 'minimal' | 'professional' | 'narrative';
```

| 风格 | 提示词 |
|------|--------|
| auto | 根据图片自动选择风格 |
| fun | 活泼有趣，像讲故事 |
| sexy | 优雅迷人，富有吸引力 |
| artistic | 艺术感，像描述画作 |
| poetic | 诗意，充满意境 |
| minimal | 最简洁，只保留核心信息 |
| professional | 专业简洁，客观描述 |
| narrative | 故事叙述，描述场景 |

### Prompt 结构

```typescript
// 中文
`识别这张图片。
输出格式: 分类 | 文件名
分类用一个词，文件名用中文，控制在15-25个字以内。
${stylePrompt}
示例: 猫咪 | 慵懒的黑白猫咪在窗台晒太阳`

// 英文
`Identify this image.
Output format: CATEGORY | FILENAME
One word category. Filename in English, 3-8 words max.
${stylePrompt}
Example: cat | lazy_cat_sunbathing_on_window`
```

### sanitizeFilename 改造

```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '')  // 移除文件系统禁用字符
    .replace(/\s+/g, '_')           // 空格转下划线
    .trim()
    .slice(0, 50) || 'unnamed';     // 长度限制（英文50，中文实际由prompt控制）
}
```

### 配置优先级

```
filenameStylePrompt (最高) → 用户自定义
filenameStyle (其次) → 预设风格
默认 → auto
```

## Risks / Trade-offs

**风险**: 中文文件名在某些系统可能有问题
→ **缓解**: 现代 OS 都支持 UTF-8，问题很小；用户可选择英文风格