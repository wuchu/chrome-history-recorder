# Repository Guidelines

## Project Structure & Module Organization

`browser-media-recorder` is a pnpm workspace defined in `pnpm-workspace.yaml`. Two packages live under `packages/`:

- `packages/extension` — WXT + React Chrome extension. Source under `src/`, split into `entrypoints/` (`background`, `devtools-panel`, `options`), reusable `background/` services, `shared/` types, and `utils/`. Build artifacts land in `.wxt/` (gitignored).
- `packages/vfs-service` — Node service backing the extension. Code in `src/`, tests in `test/`, build output in `dist/`, SQL/templates in `templates/`.

Specifications and proposed changes live in `openspec/` (driven by the OpenSpec skills in `.codex/skills/`). Top-level docs: `README.md`, `ARCHITECTURE.md`.

## Build, Test, and Development Commands

Run from the repo root unless noted.

- `pnpm dev` — Concurrently starts `vfs-service` and the extension dev build (auto-launches Chromium).
- `pnpm dev:no-browser` — Same as above without launching Chromium.
- `pnpm dev:extension` / `pnpm dev:vfs` — Run a single package in dev mode.
- `pnpm build` — Builds `vfs-service` then the extension (`packages/extension/.wxt/chrome-mv3`).
- `pnpm zip` — Packages the built extension for distribution.
- `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` — Vitest suites.
- `pnpm lint` / `pnpm lint:fix` — ESLint over the workspace.
- `pnpm format` / `pnpm format:check` — Prettier write/check.

## Coding Style & Naming Conventions

TypeScript everywhere. Prettier (`.prettierrc.mjs`) enforces 2-space indent, single quotes, semicolons, ES5 trailing commas, 100-col width, LF endings. ESLint extends `@eslint/js` + `typescript-eslint` recommended with `eslint-config-prettier`; unused vars must be prefixed `_` to silence. Use `camelCase` for variables/functions, `PascalCase` for React components and types, `kebab-case` for filenames except React components (e.g. `App.tsx`, `useOptionsData.ts`, `ollama-client.ts`).

## Testing Guidelines

Vitest (`vitest.config.ts`) discovers `packages/**/test/**/*.test.ts` in a Node environment. Place tests beside the package under `packages/<pkg>/test/`, named `<unit>.test.ts`. Coverage uses the v8 provider (`pnpm test:coverage`); aim to cover new public APIs and protocol changes in `vfs-service`.

## Commit & Pull Request Guidelines

History favors Conventional Commits (`feat:`, `feat(scope):`, `docs:`, `refactor:`); follow that pattern with imperative subjects. Husky runs `lint-staged` (`eslint --fix`, `prettier --write`) on commit—keep commits clean. PRs should describe intent, link any OpenSpec change under `openspec/changes/`, list manual verification (e.g. `pnpm test`, extension reload steps), and include screenshots/GIFs for UI tweaks in `entrypoints/devtools-panel` or `entrypoints/options`.

## Agent-Specific Instructions

Use Codex skills under `.codex/skills/` (especially the `openspec-*` flow) for proposing, applying, and archiving spec-driven changes. Do not reintroduce `.claude/` or `.agents/` directories—Codex is the only supported agent surface here.
