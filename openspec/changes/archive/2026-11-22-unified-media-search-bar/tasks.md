## 1. VFS query and search index

- [x] 1.1 Add optional `terms`, `excludeTerms`, `tagGroups`, and `sourceDomains` fields to the VFS `ListQuery` and the extension `MediaListQuery`.
- [x] 1.2 In `listFiles`, build one positive condition per term and join them with AND alongside the existing structured filters; treat `q` as an additional term when `terms` is present.
- [x] 1.3 Add exclusion conditions for `excludeTerms` using `NOT (...)`.
- [x] 1.3a Add OR-inside/AND-across conditions for `tagGroups` and OR matching for `sourceDomains`.
- [x] 1.4 Reuse the existing FTS/LIKE decision per term, including CJK and short-query fallback.
- [x] 1.5 Add `source_domain` to the FTS `search_text` triggers and to the LIKE fallback concatenation.
- [x] 1.6 Bump `SEARCH_SCHEMA_VERSION` and rebuild the FTS index transactionally for existing workspaces.
- [x] 1.7 Add VFS tests for multi-term AND, exclusion, phrase terms, mixed-field matches, CJK, source-domain search, `q` compatibility, and FTS-unavailable fallback.

## 2. Extension query plumbing

- [x] 2.1 Extend the shared `MediaListQuery` type with `terms` and `excludeTerms`.
- [x] 2.2 Pass terms and exclusions through `useHistoricalImages` and reset pagination when the parsed query changes.
- [x] 2.3 Add tests for query serialization, pagination reset, and stale-response handling.

## 3. Query parser

- [x] 3.1 Create a query parser module that tokenizes free terms, quoted phrases, negated terms, and qualifiers.
- [x] 3.2 Implement known qualifier aliases for tag, site, type, status, relative date, absolute date, and starred; support `#tag` shorthand.
- [x] 3.3 Implement tag token semantics: repeated `tag:` means AND and `tag:a|b` means OR.
- [x] 3.4 Implement NFKC/lowercase normalization, unknown-qualifier fallback to text, and incomplete-qualifier handling.
- [x] 3.5 Add parser unit tests for Chinese and English aliases, quoted values with spaces, URL colons, unknown fields, incomplete qualifiers, relative dates, and tag expressions.

## 4. Suggestions and recommendations

- [x] 4.1 Build a suggestion engine over tag vocabulary/counts, source domains, static dimension values, and quick filters.
- [x] 4.2 Add suggestion ordering and grouping by exact, prefix, and substring match, then usage count.
- [x] 4.3 Add recent-search storage and a clear action.
- [x] 4.4 Add no-result recovery helpers that suggest removing a condition, clearing all conditions, or trying a matched tag or site.
- [x] 4.5 Add unit tests for suggestion ordering, token insertion, recent-search handling, and the no-silent-rewrite rule.

## 5. Media Library UI

- [x] 5.1 Replace the filter row with one search input while keeping sort, tag tabs, and selection mode.
- [x] 5.2 Render applied-condition chips, the result count, and a clear-all action.
- [x] 5.3 Add the suggestion popover with grouped options, keyboard navigation, focus shortcuts, and an IME composition guard.
- [x] 5.4 Add empty-state recommendations and no-result recovery actions.
- [x] 5.5 Wire the parsed query into `useHistoricalImages` with a short debounce and stale-request cancellation.
- [x] 5.6 Persist the raw query and sort in `sessionStorage`, and migrate the previous `LibraryFilters` state.
- [x] 5.7 Make tag tabs write `tag:` tokens and derive the active tab from the parsed query.
- [x] 5.8 Add component tests for filter-row removal, applied chips, suggestion selection, IME behavior, persistence, migration, and no-result recovery.

## 6. Documentation

- [x] 6.1 Update the Media Library usage paragraph in `README.md`.
- [x] 6.2 Update `packages/extension/README.md` with the unified search bar.
- [x] 6.3 Document query examples covering free terms, tag OR groups, site, type, status, dates, starred, and exclusions.

## 7. Verification

- [x] 7.1 Run `pnpm test`.
- [x] 7.2 Run `pnpm lint`.
- [x] 7.3 Run `pnpm build`.
- [x] 7.4 Manually verify Chinese and English single/multi-term search, qualifiers, OR groups, exclusions, IME input, keyboard navigation, tag tabs, empty and no-result states, old-filter migration, and the FTS-unavailable fallback.
