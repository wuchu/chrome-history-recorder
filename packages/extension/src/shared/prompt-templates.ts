/**
 * Shared AI prompt templates.
 *
 * Templates use `{{key}}` placeholders that are substituted before a request
 * is sent. The built-in defaults here are the single source of truth for the
 * background engine and the Options editor. User overrides live in
 * `ExtensionConfig.promptTemplates`; empty values fall back to these defaults.
 */

export interface PromptTemplates {
  classify?: string;
  rename?: string;
}

/**
 * Built-in default templates. The Chinese variants become the defaults; the
 * runtime Chinese/English prompt branches were removed in favor of one
 * user-editable template per prompt.
 */
export const DEFAULT_PROMPT_TEMPLATES: Required<PromptTemplates> = {
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
};

/**
 * Substitute `{{key}}` placeholders in a template. Unknown keys are left
 * unchanged so a template typo degrades gracefully instead of throwing.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? vars[key] : match
  );
}

/**
 * Resolve a user template to the built-in fallback when it is unset, empty, or
 * whitespace-only, so clearing a prompt never leaves the model with no prompt.
 */
export function resolveTemplate(template: string | undefined, fallback: string): string {
  return template && template.trim().length > 0 ? template : fallback;
}
