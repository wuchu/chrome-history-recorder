## Why

All AI prompt text — the tag-classification prompt, the rename prompt, and the tag-translation prompt — is hardcoded inside the Extension Background `OllamaClient`. Users cannot tune output rules, filename phrasing, or translation formatting without editing source and rebuilding. The Options page already exposes a single prompt override (`filenameStylePrompt`), so generalizing that precedent into editable prompt templates is the natural next step.

## What Changes

- Introduce a prompt-template system backed by extension config: each AI prompt becomes a single editable template with `{{placeholder}}` variables, replacing the hardcoded Chinese/English prompt branches.
- Provide templates for `classify` (placeholder `{{vocabulary}}`), `rename` (naming style written inline), and `translate` (placeholder `{{input}}`).
- Remove the filename-style selector and its custom-prompt override (`filenameStyle` / `filenameStylePrompt`); the naming style is now authored directly inside the rename template.
- Add an "AI 提示词模板" settings section to the Options page: one text area per template, placeholder help text, and a per-template "restore default" action.
- Empty or missing templates fall back to the built-in default so AI tasks cannot be bricked by a cleared prompt.
- Remove the runtime `language`-based prompt branching; `language` no longer switches prompt text. **BREAKING** for any config relying on the prior English prompt variants (now a single user-authored template).

## Capabilities

### New Capabilities

- `ai-prompt-templates`: user-editable AI prompt templates with `{{placeholder}}` substitution, built-in defaults, empty-value fallback, per-template reset, and the Options-page editor.

### Modified Capabilities

- `ollama-classifier`: the classification prompt is now built from a user-editable template (falling back to the built-in default) instead of a hardcoded string.
- `ai-auto-rename`: the rename prompt is now built from a user-editable template with the naming style written inline.
- `extension-options-config`: adds a prompt templates settings section to the Options page.

## Impact

- `packages/extension/src/shared/prompt-templates.ts` — new module holding `PromptTemplates`, `DEFAULT_PROMPT_TEMPLATES`, `renderTemplate`, and `resolveTemplate`.
- `packages/extension/src/background/classify/ollama-client.ts` — replace hardcoded `buildTagsPrompt` / `buildRenamePrompt` / `translateTags` prompt strings with template resolution; remove `STYLE_PROMPTS_ZH`/`STYLE_PROMPTS_EN` and the style config fields.
- `packages/extension/src/shared/extension-runtime.ts` — remove `FilenameStyle` and the `filenameStyle`/`filenameStylePrompt` config fields; add `promptTemplates`.
- `packages/extension/src/background/config-manager.ts` — apply `promptTemplates` to the Ollama client on config load/update.
- `packages/extension/src/entrypoints/options/App.tsx` + `hooks/useOptionsData.ts` — add the template editor section and remove the filename-style selector.
- `packages/extension/src/entrypoints/background/index.ts` — drop `filenameStyle`/`filenameStylePrompt` from Ollama client init.
