## 1. Shared types and defaults

- [x] 1.1 Add `PromptTemplates` interface and `promptTemplates?: PromptTemplates` to `ExtensionConfig` in `packages/extension/src/shared/extension-runtime.ts`
- [x] 1.2 Extract the current Chinese prompt strings into exported `DEFAULT_PROMPT_TEMPLATES` (`classify`, `rename`, `translate`), removing the Chinese/English branches
- [x] 1.3 Add a `renderTemplate(template, vars)` helper that substitutes `{{key}}` placeholders and preserves unknown keys

## 2. Prompt building in OllamaClient

- [x] 2.1 Refactor `buildTagsPrompt` to accept an optional template and render `{{vocabulary}}`, falling back to the default when unset
- [x] 2.2 Refactor `buildRenamePrompt` to accept an optional template and render `{{style}}` (resolving the style value from `filenameStylePrompt ?? STYLE_PROMPTS_*[style]`)
- [x] 2.3 Refactor `translateTags` to accept an optional template and render `{{input}}`, falling back to the default

## 3. Config plumbing

- [x] 3.1 Add `promptTemplates` to `OllamaClientConfig` and the constructor defaults in `ollama-client.ts`
- [x] 3.2 Pass `promptTemplates` from `ConfigManager.applyConfig` into `ollamaClient.updateConfig`
- [x] 3.3 Ensure the configured translate template reaches the `translate-tags` handler in `packages/extension/src/entrypoints/background/index.ts`

## 4. Options page editor

- [x] 4.1 Add prompt-template state, save, and reset handlers to `packages/extension/src/entrypoints/options/hooks/useOptionsData.ts`
- [x] 4.2 Add an "AI 提示词模板" section to `packages/extension/src/entrypoints/options/App.tsx` with one text area per template, placeholder help, and a per-template restore-default action

## 5. Verification

- [x] 5.1 Add unit tests for `renderTemplate` and the default fallback behavior
- [x] 5.2 Run `pnpm test`, `pnpm lint`, and `pnpm format:check`, and manually verify template editing + reset in the Options page
