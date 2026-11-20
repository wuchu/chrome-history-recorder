"use strict";
/**
 * AI prompt templates.
 *
 * Templates use `{{key}}` placeholders that are substituted before a request
 * is sent. The built-in defaults are the source of truth for prompts when the
 * user has not overridden them in app configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROMPT_TEMPLATES = void 0;
exports.renderTemplate = renderTemplate;
exports.resolveTemplate = resolveTemplate;
exports.DEFAULT_PROMPT_TEMPLATES = {
    classify: `识别这张图片，生成 3 到 8 个描述图片内容的标签。
{{vocabulary}}

输出要求：
- 每行一个标签，不要编号、不要解释、不要标点。
- 复用已有标签时直接输出标签名。
- 词表中没有的新概念，输出 NEW:标签名。
- 标签使用小写，2-6 个字。`.trim(),
    rename: `观察这张图片，为它生成一个简洁生动的文件名（不含扩展名）。
风格要求：根据图片内容和氛围，自动选择最合适的描述风格。
文件名控制在 15-25 个字以内。
只输出文件名本身，不要引号、扩展名或任何解释。`.trim(),
    translate: `请将以下标签翻译成中文，并保留原来的格式（每行一个标签，如果有逗号分隔，左边是英文名称，右边是中文显示名称）。

如果一行只有一个词，请同时生成英文名称和中文显示名称，用逗号分隔。

输入：
{{input}}

直接输出结果，不要任何其他说明。`.trim(),
};
/**
 * Substitute `{{key}}` placeholders in a template. Unknown keys are left
 * unchanged so a template typo degrades gracefully instead of throwing.
 */
function renderTemplate(template, vars) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => key in vars ? vars[key] : match);
}
/**
 * Resolve a user template to the built-in fallback when it is unset, empty, or
 * whitespace-only, so clearing a prompt never leaves the model with no prompt.
 */
function resolveTemplate(template, fallback) {
    return template && template.trim().length > 0 ? template : fallback;
}
//# sourceMappingURL=prompt-templates.js.map