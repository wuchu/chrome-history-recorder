## Why

The Media Library header currently exposes a search input plus seven separate controls (type, source site, date, classification status, sort, tags, starred). The row is visually dense, and users must translate one intent such as "最近一周 pixiv 的猫图" into several independent controls. At the same time, free text is matched as one literal phrase, so typing `猫 壁纸` does not mean "contains 猫 AND 壁纸".

A single search box that understands dimensions and offers suggestions keeps the header clean while making multi-dimensional retrieval feel natural. This change is interaction-first: the primary outcome is a simpler Media Library surface, not a general-purpose search engine.

## What Changes

- Replace the Media Library filter row with one search input. Sorting remains a separate compact control; the tag tab bar remains as a discovery shortcut.
- Parse the query into dimensions: free terms, tag, source site, media type, classification status, date range, starred, and exclusions. Support Chinese and English qualifier aliases plus `#tag` shorthand.
- Match multiple free terms with AND across AI filename, tags, source URL/domain, and user notes. Quoted text remains an exact phrase; `-term` excludes a term.
- Add suggestions and recommendations:
  - typeahead for tags, sites, types, statuses, dates, and recent searches;
  - an empty-state panel with recent searches, top tags, top sites, and quick filters;
  - a no-result recovery panel that suggests removing one condition or trying a matched tag/site.
- Show applied conditions as removable chips under the input, together with the result count and a clear-all action.
- Persist the raw query for the Options page session and migrate the previous filter state into query text.
- Extend the VFS list query with multi-term matching (`terms`, `excludeTerms`), tag OR groups (`tagGroups`), and multi-site OR (`sourceDomains`), and include the normalized source domain in searchable text. Existing structured facets remain available.
- Out of scope for this change: relevance ranking, silent typo correction, pinyin search, automatic natural-language parsing, and size/hash filters.

## Capabilities

### New Capabilities

- `media-search-query`: single-box query grammar, dimension parsing, multi-term matching semantics, and the suggestion/recommendation contract.

### Modified Capabilities

- `options-media-library`: the search bar becomes the primary filter surface; applied-condition chips, suggestion states, and query persistence replace the separate filter controls. Sorting and tag tabs remain.
- `multi-tag-filtering`: multi-tag filtering is expressed through query tokens. Repeated `tag:` tokens mean AND, `tag:a|b` means OR, and tag tabs write a single tag token. The standalone tag-mode control is removed from the library header.
- `vfs-service`: `listFiles` supports multi-term AND and exclusion over searchable text, and the search index includes the normalized source domain. Existing structured filters and tag modes remain compatible.

## Impact

- `packages/extension/src/entrypoints/options/components/MediaLibrary.tsx`: replace filter state and controls with parsed query state, suggestions, and applied chips.
- New query parser and suggestion modules under `packages/extension/src/entrypoints/options/` (or a shared location if reused).
- `packages/extension/src/entrypoints/media-browser/hooks/useHistoricalImages.ts`: pass free terms and exclusions through the list query.
- `packages/extension/src/shared/extension-runtime.ts`: extend `MediaListQuery` with `terms` and `excludeTerms`.
- `packages/vfs/src/api.ts`, `packages/vfs/src/sqlite.ts`: build per-term AND conditions and expand indexed search text. The VFS dispatcher already forwards list parameters unchanged, so no app-layer changes are expected.
- Documentation: the Media Library usage paragraph in `README.md` and `packages/extension/README.md`.
- No new Chrome permissions; suggestions reuse existing tag counts, tag vocabulary, source-domain data, and local storage.
