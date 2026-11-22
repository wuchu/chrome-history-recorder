## Context

The Media Library header in the Options console currently renders one small text input plus seven separate controls: type, source site, date preset, classification status, sort, tag selection with match mode, and a starred switch. The filter state lives in a `LibraryFilters` object persisted in `sessionStorage`, and each control maps directly to a field in `MediaListQuery`.

The VFS list query already supports structured facets (`mimeType`, `sourceDomain`, `capturedFrom`/`capturedTo`, `starred`, `classifyStatus`, `tags`/`tagMode`) and a free-text `q`. Text search is backed by an FTS5 trigram index when available and falls back to `LIKE` across AI filename, tags, source URL, and user notes. Crucially, `q` is matched as one literal phrase: `猫 壁纸` does not mean "contains 猫 AND 壁纸".

Existing specs that describe the current behavior:

- `options-media-library`: "Media library search and structured filters", "Media library sort control", "Empty and disconnected states".
- `multi-tag-filtering`: tag tabs, multi-tag selection and match mode, full tag vocabulary access.
- `vfs-service`: "VFS Service provides searchable media queries", "VFS Service maintains a full-text index".

The primary product goal is visual simplicity in the Media Library header. The technical goal is to let one query express several dimensions without adding more controls.

## Goals / Non-Goals

**Goals:**

- Replace the seven filter controls with one search input and keep the header visually quiet.
- Parse one query string into free terms plus structured facets.
- Make multiple free terms combine with AND across searchable fields.
- Provide typeahead suggestions, empty-state recommendations, and no-result recovery without a new backend service.
- Keep sort, tag tabs, selection mode, and the existing grid behavior intact.
- Preserve the existing Options-session view state through a migration from the old filter object.

**Non-Goals:**

- Relevance ranking or a "best match" sort.
- Silent typo correction or edit-distance result matching.
- Pinyin, synonym expansion, or semantic search.
- Automatic natural-language parsing of arbitrary sentences.
- New dimensions such as size, hash, model, or confidence.
- Search in the Side Panel or a global command palette.
- Changing tag governance, export, trash, or task behavior.

## Decisions

### D1: The raw query string is the single source of truth

Keep `rawQuery: string` as the only filter state, parse it into a `ParsedQuery`, and keep `sort` as a separate value. Remove the old `LibraryFilters` object as the source of truth.

**Why:** applied-condition chips, suggestion insertion, and persistence all become edits to one string. There is no two-way synchronization between dropdown state and text state.

**Alternative considered:** keep the structured filter object as truth and regenerate a display string. Rejected because cursor edits, chip removal, and query persistence would all need to reverse-map into the object.

### D2: Parse in the extension, send structured data to VFS

The extension owns query syntax and suggestion behavior. The parser output maps onto the existing `MediaListQuery` fields plus new `terms` and `excludeTerms` arrays. The VFS service never parses user syntax.

**Why:** UI aliases and suggestion rules change with the UI; the storage API should stay a stable structured contract. Parsing in the extension also lets suggestions reuse the active token and its parsed facets.

**Alternative considered:** send the raw query to VFS and parse there. Rejected because it couples storage to UI language, duplicates aliases across packages, and makes typeahead suggestions harder.

### D3: One bar replaces the filter row; sort and tag tabs remain

Remove the type, site, date, status, tag, tag-mode, and starred controls from the header. Keep:

- the search input,
- the sort control,
- the tag tab bar as a discovery shortcut,
- the selection mode button.

Applied conditions render as removable chips under the input, followed by the result count and a clear-all action.

**Why:** this directly serves the product goal. Keeping hidden duplicates of the old controls would preserve the visual clutter and create two state paths.

**Alternative considered:** keep the filter row behind an "advanced filters" popover. Deferred; it can be added later without changing the query grammar, but it is unnecessary for v1 because the suggestion dropdown exposes the same dimensions.

### D4: Query grammar uses known qualifiers only

Recognized dimensions and aliases:

| Intent | Syntax | Example |
| --- | --- | --- |
| Free terms | bare words, AND | `猫 壁纸` |
| Exact phrase | double quotes | `"digital art"` |
| Exclusion | leading `-` | `-nsfw` |
| Tag | `tag:`, `标签:`, `#` | `tag:风景`, `#猫` |
| Tag OR | `\|` inside a tag value | `tag:风景\|cat` |
| Source site | `site:`, `站点:` | `site:pixiv.net` |
| Media type | `type:`, `类型:` | `type:image` |
| Classification status | `status:`, `状态:` | `status:failed` |
| Date | `date:`, `时间:` | `date:7d`, `date:today` |
| Absolute date | `after:`, `before:` | `after:2026-11-01` |
| Starred | `starred`, `收藏` | `starred` |

Rules:

- Only known qualifier names produce facets. `https://...` or any unknown `foo:bar` remains free text.
- An incomplete qualifier such as `tag:` produces suggestions but no filter.
- Quoted values may contain spaces.
- Free terms are normalized with NFKC and lowercasing before matching.
- Repeated `tag:` tokens mean AND; `tag:a|b` means OR. The parser emits repeated
  tags as `tags` with `tagMode = 'and'`, and OR groups as `tagGroups`.
- Multiple `site:` values are emitted as `sourceDomains` and matched with OR.
- The current list API accepts one media type and one classification status, so
  when a query repeats either dimension the last valid value wins.

**Why:** a small, predictable grammar is enough for the existing dimensions, and conservative parsing avoids surprising URL or prose queries.

### D5: Multi-term AND is added to `listFiles`

Add optional `terms?: string[]` and `excludeTerms?: string[]` to `ListQuery`/`MediaListQuery`.

- Each included term matches across AI filename, tags, source URL/domain, and user notes.
- All included terms must match.
- Each excluded term must not match.
- `q` remains supported and behaves as a single term for compatibility.
- The existing structured facets combine with terms using AND.
- `tagGroups` expresses `(a OR b) AND (c OR d)`, and `sourceDomains` expresses
  an OR across source sites.

Implementation reuses the current FTS/`LIKE` decision per term. For each term the backend builds one condition; the conditions are joined with `AND`. Exclusions use `NOT (...)`.

**Why:** this is the smallest backend change that makes "多维模糊" real. Client-side intersection of separate paginated queries would break totals, cursors, and infinite scroll.

**Alternative considered:** tokenize the query in SQL with `LIKE` on a concatenated column. Rejected because field-aware scoring and future per-field qualifiers would be harder.

### D6: Include the normalized source domain in searchable text

Add `source_domain` to the FTS `search_text` and to the `LIKE` fallback concatenation. Bump `SEARCH_SCHEMA_VERSION` and rebuild the FTS table transactionally on workspace open.

**Why:** `site:` already uses the structured `source_domain` field, but free-text searches for a domain should not depend on the full URL string. Including the normalized domain makes text and facet results consistent.

**Note:** `category` is not added as a search dimension. AI classification intentionally does not write `category`; tags are the maintained taxonomy.

### D7: Suggestions are client-side and non-destructive

Suggestion data:

- tag vocabulary and usage counts from `getTagCounts`/`listTags`,
- source domains from `getSourceDomains`,
- recent searches from local storage,
- static quick filters (image, video, starred, uncategorized, recent 7 days, failed).

Suggestion groups, in order:

1. exact/prefix tag matches,
2. exact/prefix source-site matches,
3. dimension suggestions (`type:`, `status:`, `date:`, `starred`),
4. recent searches,
5. quick filters.

Selecting a suggestion inserts the corresponding token or value at the active token; it never silently rewrites the user's text. Suggestions are computed locally and do not require a new VFS endpoint.

**Why:** the existing vocabulary is small enough for local fuzzy matching, and local suggestions are instant and private. Not auto-applying corrections keeps precision predictable.

### D8: Input behavior accounts for Chinese IME and keyboard use

- Do not query or open suggestions while `compositionstart` is active; commit on `compositionend`.
- `ArrowUp`/`ArrowDown` move through suggestions.
- `Enter` accepts the highlighted suggestion; with no highlight it runs the raw search.
- `Tab` accepts a suggestion and keeps focus.
- `Escape` closes the suggestion panel; a second `Escape` or the clear button clears the query.
- `/` and `Cmd/Ctrl+K` focus the search input when focus is not already in a text field.
- Debounce result queries by roughly 250 ms and discard stale responses using the existing request-id pattern.

**Why:** Chinese IME composition is the most common source of flicker and broken queries in this UI, and the keyboard rules make the bar usable without the mouse.

### D9: No relevance ranking in this change

Keep the existing sort controls and the default newest-first order. Do not add a relevance score or change cursor encoding.

**Why:** relevance requires a scoring expression that works for both trigram FTS and CJK `LIKE` paths, plus cursor changes. That is a separate quality change. This change is about a clean, composable query surface.

**Trade-off:** users may expect "most relevant first". The UI should label the active sort and the change should leave a clean path to add `orderBy: relevance` later.

### D10: Tag tabs are derived shortcuts, not separate state

Clicking a tag tab replaces any existing tag tokens with one `tag:<name>` token while leaving non-tag conditions intact. A tab is visually active only when the parsed query contains exactly one tag token matching that tab and no tag OR group.

**Why:** this keeps one state source and avoids a situation where the tab says "猫" while the query says something else.

### D11: Persistence and migration

Store `{ rawQuery, sort }` under a new session key, for example `media-library-query-v1`, using `sessionStorage` to match the current Options-session behavior.

On first load, if the old `media-library-filters-v1` object exists:

1. Convert `q`, `mimeType`, `sourceDomain`, `datePreset`, `starred`, `classifyStatus`, `tags`, and `activeTag` into query text.
2. Write the new key.
3. Remove the old key.

If conversion fails, fall back to an empty query and keep the library usable.

## Risks / Trade-offs

- **Syntax discoverability** → The suggestion dropdown, placeholder, inline hint, and applied chips are the teaching surface. No documentation should be required to use common dimensions.
- **IME flicker or premature queries** → Guard all query and suggestion work behind `compositionstart`/`compositionend`; add tests around composition.
- **Colon ambiguity in URLs and prose** → Only known qualifiers are parsed; unknown `foo:bar` remains text.
- **Multi-term `LIKE` cost** → Personal libraries are small; terms still use FTS where eligible. Measure with a large workspace and avoid scanning blob data.
- **No relevance ranking** → Keep the sort control visible and label the default. Treat relevance as a follow-up change.
- **FTS schema rebuild** → Perform the delete/backfill transactionally and retain the `LIKE` fallback if FTS is unavailable. Rollback remains safe because the new API fields are optional.
- **Tag tab/query drift** → Derive the active tab from the parsed tag tokens rather than keeping an independent `activeTag` value.
- **Suggestion staleness** → Refresh tag and source-domain suggestions on the existing `tags:updated` event and on VFS reconnect.
- **Migrated old filters** → Conversion is best-effort; an unparseable old value falls back to an empty query instead of blocking the library.
- **Broader text matches** → Adding `source_domain` can produce slightly broader matches than before; this is intentional and consistent with `site:`.

## Migration Plan

1. Add optional `terms`/`excludeTerms` to the VFS API and extension query types. Old clients continue to use `q` and structured facets unchanged.
2. Update FTS triggers and bump `SEARCH_SCHEMA_VERSION`; rebuild the index on workspace open. The `LIKE` fallback includes `source_domain` immediately.
3. Ship the parser and suggestion modules behind the existing Media Library component; replace the filter row.
4. On first load, convert the old filter object into a raw query and write the new session key.
5. Documentation updates in `README.md` and `packages/extension/README.md`.

Rollback: revert the extension, leave the additive backend fields in place. The rebuilt FTS index remains readable by the previous code because `search_text` is still a single text column; older triggers are not re-created once the schema version is already high enough.

## Open Questions

- Should repeated tag tokens default to AND (proposed) or follow the old OR default?
- Should selecting a tag tab clear non-tag conditions, or only replace tag tokens (proposed)?
- Should recent searches persist across browser sessions in `chrome.storage.local`, or remain session-only?
- Should the query be deep-linkable as `#library?q=...` in a follow-up, so the Side Panel can hand off a specific search?
- Should fuzzy "did you mean" suggestions for tags and sites be included in v1.5?
- Should the suggestion dropdown eventually include matching media thumbnails?
