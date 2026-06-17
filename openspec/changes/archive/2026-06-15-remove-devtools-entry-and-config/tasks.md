## 1. Migrate shared assets from devtools-panel to media-browser

- [x] 1.1 Move `devtools-panel/components/` to `media-browser/components/`
- [x] 1.2 Move `devtools-panel/hooks/` to `media-browser/hooks/` (excluding useNetworkListener.ts)
- [x] 1.3 Move `devtools-panel/i18n.ts` to `media-browser/i18n.ts`
- [x] 1.4 Move `devtools-panel/locales/` to `media-browser/locales/`
- [x] 1.5 Move `devtools-panel/App.module.css` to `media-browser/App.module.css`

## 2. Update import paths

- [x] 2.1 Update `media-browser/components.ts` to import from `./components/`
- [x] 2.2 Update `media-browser/hooks.ts` to import from `./hooks/`
- [x] 2.3 Update `media-browser/styles.ts` to import from `./App.module.css`
- [x] 2.4 Update `sidepanel/main.tsx` to import i18n from `../media-browser/i18n`

## 3. Remove DevTools configuration and unused code

- [x] 3.1 Remove `devtools_page: 'devtools.html'` from `wxt.config.ts`
- [x] 3.2 Delete `src/entrypoints/devtools.html`
- [x] 3.3 Delete `src/entrypoints/devtools-panel/` (entire directory)
- [x] 3.4 Delete `src/utils/networkListener.ts`
- [x] 3.5 Delete `src/utils/networkTypes.ts`

## 4. Verify changes

- [x] 4.1 Run `pnpm build` to verify no TypeScript errors
- [x] 4.2 Run `pnpm lint` to verify no lint errors
- [x] 4.3 Test the extension to verify Side Panel still works
