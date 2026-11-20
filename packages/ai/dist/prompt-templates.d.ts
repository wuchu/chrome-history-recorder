/**
 * AI prompt templates.
 *
 * Templates use `{{key}}` placeholders that are substituted before a request
 * is sent. The built-in defaults are the source of truth for prompts when the
 * user has not overridden them in app configuration.
 */
export interface PromptTemplates {
    classify?: string;
    rename?: string;
    translate?: string;
}
export declare const DEFAULT_PROMPT_TEMPLATES: Required<PromptTemplates>;
/**
 * Substitute `{{key}}` placeholders in a template. Unknown keys are left
 * unchanged so a template typo degrades gracefully instead of throwing.
 */
export declare function renderTemplate(template: string, vars: Record<string, string>): string;
/**
 * Resolve a user template to the built-in fallback when it is unset, empty, or
 * whitespace-only, so clearing a prompt never leaves the model with no prompt.
 */
export declare function resolveTemplate(template: string | undefined, fallback: string): string;
//# sourceMappingURL=prompt-templates.d.ts.map