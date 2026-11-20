## Context

The Extension Background `OllamaClient` ([ollama-client.ts](../../../packages/extension/src/background/classify/ollama-client.ts)) hardcodes every AI prompt:

- `buildTagsPrompt(vocabulary, language)` — the classify prompt, with a bounded tag-vocabulary block.
- `buildRenamePrompt(config)` — the rename prompt, embedding a style flavor.

Each prompt has a Chinese/English branch keyed on `language?.startsWith('zh-')`. The config system already carries one user-editable prompt fragment, `filenameStylePrompt`, which flows `Options → updateConfig → ConfigManager → OllamaClient`. This change generalizes that single override into a full template system.

## Goals / Non-Goals

**Goals:**

- Make the classify and rename prompts editable from the Options page as single templates.
- Keep the existing config plumbing (`chrome.storage.local` → `ExtensionConfig` → `applyConfig` → `OllamaClient`).
- Guarantee AI tasks keep working when a template is cleared, by falling back to built-in defaults.

**Non-Goals:**

- Keeping a filename-style selector: style switching is removed; the naming style is authored directly inside the rename template.
- Making prompt content per-language; there is exactly one template per prompt.

## Decisions

### D1 — One template per prompt; drop the runtime language branch

Each prompt (`classify`, `rename`) has a single editable template. `buildTagsPrompt` / `buildRenamePrompt` no longer branch on `language`. The current Chinese variant becomes the built-in default; the English variants are removed from source.

- *Alternative considered*: keep two templates per prompt (zh/en) selected by `language`. Rejected — doubles the editor surface and most users use a single language; the user explicitly chose one template.
- *Consequence*: the `language` config field and the "输出语言" selector no longer change prompt text. They are left in place (no schema removal) to avoid breaking stored config and unrelated future use, but the prompt engine ignores `language`.

### D2 — Placeholder syntax `{{key}}` + a `renderTemplate` helper

Templates use `{{key}}` placeholders. A small `renderTemplate(template, vars)` replaces each known key and leaves unknown keys untouched (so a typo degrades gracefully rather than throwing).

- `classify` → `{{vocabulary}}`

The `rename` template has no placeholder — its naming style is written inline. The built-in defaults use the same placeholders as user templates, so defaults and user templates are interchangeable.

### D3 — Storage shape: nested `promptTemplates` on `ExtensionConfig`

Add `promptTemplates?: PromptTemplates` to `ExtensionConfig`, where:

```ts
interface PromptTemplates {
  classify?: string;
  rename?: string;
}
```

It lives in the same `vfsConfig` storage key and rides the existing `getConfig` / `updateConfig` / `applyConfig` path. `applyConfig` passes `promptTemplates` into `OllamaClient.updateConfig`.

- *Alternative considered*: a separate `vfsPromptTemplates` storage key with its own message pair. Rejected — more plumbing for no behavioral gain; the config object is the established source of truth.

### D4 — Fallback and reset semantics

A template is treated as "unset" when it is `undefined`, empty, or whitespace-only. In that case the corresponding built-in default is used. The Options page offers a per-template "恢复默认" action that clears the stored value (reverting to the built-in default), plus placeholder help text.

Defaults are exported as `DEFAULT_PROMPT_TEMPLATES` from the shared `prompt-templates.ts` module so the editor can show them and the engine can fall back to them.

### D5 — Naming style is baked into the rename template

The filename-style selector and its custom-prompt override are removed. The default rename template contains the naming-style instruction inline, and users tune it by editing the rename template directly. `filenameStyle`, `filenameStylePrompt`, and the `STYLE_PROMPTS_ZH`/`STYLE_PROMPTS_EN` maps are deleted from the codebase.

## Risks / Trade-offs

- **Removing the English prompt variants** → users who relied on `language: en-US` for English output now get the Chinese default unless they paste their own English template. Mitigation: the editor documents placeholders; the built-in default is shown in the editor.
- **`language` field becomes inert for prompts** → confusion if a user changes "输出语言" and sees no effect. Mitigation: note in the design/UI copy; keep the field to avoid schema churn.
- **User writes a malformed template** (e.g., drops the `{{vocabulary}}` placeholder) → the model loses vocabulary context but the call still succeeds. Mitigation: placeholder help text in the editor; fallback only guards empty templates, not structurally incomplete ones.
- **Template stored but stale after upgrade** → no migration needed; missing keys simply fall back to defaults, and new defaults roll out automatically.

## Migration Plan

1. Add `PromptTemplates` to shared types and `DEFAULT_PROMPT_TEMPLATES` to `ollama-client.ts`.
2. Route prompt building through `renderTemplate` with fallback; wire config through `applyConfig`.
3. Add the Options "AI 提示词模板" section.
4. No storage migration: existing users have no `promptTemplates` key, which resolves to defaults. Rollback is a revert of the change; stored templates are additive and ignorable.

## Open Questions

- Should the "输出语言" selector be removed or relabeled now that it no longer affects prompts? (Left in place for this change.)
