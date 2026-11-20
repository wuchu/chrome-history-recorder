## Context

The extension currently has two user surfaces, but their responsibilities overlap:

- The Side Panel renders the **global** media library — historical masonry grid, tag tab bar, media detail, and delete actions — from `sidepanel/App.tsx` and the shared `media-browser` components, while also controlling capture for the active tab through `useSidePanelCapture`.
- The Options page is a single long configuration scroll. It has no navigation, no resource-management surface, and no overview of storage or queue state.
- Capture state is per tab (`DebuggerCaptureController.states`), but captured files are global: the app's `file:captured` event carries `{ hash, mimeType, size }` with no tab or page identity. `source_url` is the resource URL, often a CDN, not the page URL.
- Diagnostics already exist (`capture:skipped`, `capture:error`), but the Side Panel only displays counts and the latest error tooltip.

This change makes the role split explicit: **Options is the global console and library; the Side Panel is the current-tab capture cockpit.** It also introduces a single, tab-scoped capture session so the cockpit can answer “what is this tab capturing right now?” without inventing site history or changing the VFS schema.

## Goals / Non-Goals

**Goals:**

- Separate global management from tab-scoped monitoring at the information-architecture level.
- Introduce one active capture session with deterministic lifecycle, counters, and a bounded real-time event log.
- Make the Side Panel honest about which tab owns the session, including when the user switches tabs.
- Move the global media library into Options with the existing browsing, detail, delete, and requeue behavior.
- Keep the change within the extension packages: no VFS schema, `listFiles`, or app API changes.
- Preserve existing capture rules (image thresholds, video candidate rules, debugger attachment).

**Non-Goals:**

- Site history, page history, or a `capture_events` table in VFS.
- Search, source-site filtering, bulk actions, export, star, or notes editing in the media library.
- Site auto-capture rules.
- Video download progress events.
- SPA route-level session segmentation.
- A full media detail viewer inside the Side Panel.
- Changing the storage, thumbnail, or AI task pipeline.

## Decisions

### D1 — Split ownership by scope and time, not by widget

Options owns **global, historical, management** concerns. The Side Panel owns **current tab, current session, real-time, diagnostics** concerns.

- The Side Panel no longer renders the global masonry grid, global tag tabs, or the global media detail.
- The Options Media Library reuses the existing `useHistoricalImages`, `useCombinedMedia`, `VirtualMasonryGrid`, `MediaDetail`, and `ScrollableTabBar` components.
- Capture start/stop remains in the Side Panel only. The Options Overview shows session status read-only.

*Alternative considered:* keep a miniature library in the Side Panel. Rejected — it preserves the identity overlap and keeps the panel heavy. The panel keeps exactly one media surface: the current session feed.

### D2 — One session at a time, tab-scoped and sticky to its tab

A session is owned by a tab, not by an origin. It begins on explicit start and remains attached to that tab while the user switches tabs or navigates within the tab.

- Switching tabs passively does **not** stop the session. The Side Panel shows a session-in-another-tab banner with switch and stop actions.
- Starting capture in another tab shows a confirmation naming the current session tab. Confirmation ends the old session and starts the new one; cancellation changes nothing.
- Navigating the session tab to another origin keeps the session running and updates the page identity. The cockpit header shows the current page; event entries keep the page URL captured with each resource.
- Background enforces the invariant regardless of UI: `start(tabId)` first terminates any active session, and no two tabs can report `isEnabled` at once.

*Alternatives considered:* auto-stop on tab switch (rejected — silently kills a capture when the user briefly checks another tab); multiple sessions with a session manager (rejected for MVP — more UI and more privacy surface).

### D3 — Session state is ephemeral extension state, not VFS data

The session store lives in the Background Service Worker and is snapshotted to `chrome.storage.session`.

```ts
interface CaptureSession {
  id: string;
  tabId: number;
  tabTitle: string;
  pageUrl: string;
  origin: string;
  startedAt: string;
  endedAt?: string;
  status: 'capturing' | 'stopped' | 'error';
  counters: SessionCounters;
  recentItems: SessionMediaItem[]; // bounded, for the live feed
  events: SessionEvent[];          // bounded at 200
}
```

Why not VFS:

- VFS is content-addressed. The same hash can be captured from multiple tabs or sites; a `site` column on `files` would lose that many-to-many relationship.
- `source_url` is the resource URL, not the page. Inferring a site from it would surface CDN hosts.
- The requirement is only “this session”, not site history. A future `capture_events` table can add history without reworking this store.

The snapshot is written on a short throttle (for example, at most once per second) and cleared automatically on browser restart. The UI reads it through a new `capture:get-session` runtime message.

*Alternative considered:* append capture events to VFS. Deferred to a later change; it is the correct foundation for site history but unnecessary for the MVP.

### D4 — Emit session-scoped events from the Background, not by changing `file:captured`

The app's `file:captured` event remains the global library signal. It has no tab identity and is emitted only for newly stored files; duplicate saves never reach it. The Background therefore emits its own session-scoped event:

```ts
interface SessionEvent {
  sessionId: string;
  tabId: number;
  pageUrl: string;
  kind:
    | 'saved'
    | 'duplicate'
    | 'skipped'
    | 'failed'
    | 'video:candidate'
    | 'video:result'
    | 'ai';
  timestamp: string;
  hash?: string;
  mimeType?: string;
  size?: number;
  sourceUrl?: string;
  reason?: string;
  error?: string;
  aiStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}
```

- Image saves: `DebuggerCaptureController.handleLoadingFinished` already receives the `saveFile` result, including `duplicate`. It emits `saved` or `duplicate` before broadcasting.
- Videos: `VideoDownloadManager.handleResult` knows the tab and result hash. It emits `video:result` with the hash or error; candidate detection emits `video:candidate`.
- Skips and failures: the existing `capture:skipped` and `capture:error` paths feed the same session event store, so the cockpit gets reasons rather than only counts.
- AI: the Background already relays `classify:*`, `task:*`, and `file:classified` events. It checks whether the event hash belongs to the active session's saved set and, if so, emits an `ai` session event and updates AI counters.

The cockpit consumes only session events. The legacy `capture:state` event remains the per-tab status signal; legacy `capture:skipped` / `capture:error` broadcasts can remain for compatibility but are no longer the panel's data source.

*Alternative considered:* add `tabId`/`pageUrl` to the app's `file:captured`. The app does not know the tab, and duplicates would still be missing. Choosing the Background as the session event source keeps the app/VFS contract untouched.

### D5 — Counters and the event log are maintained together

One module owns the session and applies each event to both counters and the log, so a snapshot restore cannot produce divergent state.

Counters include saved, duplicate, skipped, failed, saved bytes, saved images, saved videos, AI pending/processing/completed/failed, and queued/downloading videos. The log keeps the newest 200 entries; older entries are dropped. Clearing the log keeps counters and the session active.

The live feed derives from saved items and duplicate events, bounded to the newest 20 items. Duplicate events render as a placeholder referencing the existing hash rather than disappearing.

### D6 — The Side Panel is a state machine over active tab vs session tab

The panel always renders the active tab. The session may belong to that tab or another one.

| Active tab | Session | Panel |
| --- | --- | --- |
| Session tab | capturing | Full cockpit |
| Another tab | capturing | Session-in-another-tab banner |
| Session tab | stopped | Session summary + restart |
| Any | none | Start panel |

The banner names the session tab, shows its saved count, and offers **switch to session tab** and **stop session**. The panel must never present another tab's session as the active tab's capture.

Tab identity comes from `chrome.tabs.query({ active: true, currentWindow: true })` plus `tabs.onActivated`, `tabs.onUpdated` (URL/title changes), and `windows.onFocusChanged` for multi-window refresh. The manifest already grants `<all_urls>` host permissions, which cover URL/title/favicon for normal web pages; restricted pages are shown as unsupported rather than requiring a new permission.

The session tab navigation is tracked from `tabs.onUpdated`; a URL change updates the session's current page identity without ending the session.

### D7 — The Options console uses hash routing and Ant Design tabs

The Options shell uses Ant Design `Tabs` with five tabs and keeps inactive tab panes mounted so the library retains scroll position when switching tabs.

- URL: `options.html#overview`, `#library`, `#tags`, `#tasks`, `#settings`.
- `hashchange` drives the active tab; selecting a tab updates the hash with `history.replaceState`.
- Unknown or missing hashes fall back to `#overview`.
- Side Panel handoff opens the Options URL with the target hash. The simplest reliable implementation is `chrome.tabs.create({ url: chrome.runtime.getURL('options.html#library') })`; deduplicating an existing options tab can be added later.

The Overview tab reads existing APIs: `getStats`, queue status, and a bounded `listFiles` request for recent captures. It reads the session snapshot for the read-only active-session card. It does not send start/stop messages.

### D8 — Reuse the media browser components, but decouple Side Panel assumptions

The library can reuse the existing components, with two adjustments:

- `VirtualMasonryGrid` currently listens to window scroll and `document.documentElement`. The Options console has no fixed overlay, so document scrolling remains valid; the library content should be placed in normal document flow. If a future console header becomes sticky, the grid should accept a scroll container instead.
- The media components rely on the `media-browser` theme classes and CSS variables. The Options library wrapper should use the same `useTheme` hook and apply the existing light/dark class, rather than inventing a second media theme.

The console shell keeps Ant Design styling; the media library remains the existing custom-styled island. This is accepted for the MVP to avoid a visual-system rewrite.

`MediaDetail` needs one extension for this change: display the stored `source_url` when available. The data already exists in `FileMetadata`; the current viewer ignores it.

### D9 — Library handoff is unfiltered in the MVP

The Side Panel's “open library” action opens `#library` without a session filter. The current `listFiles` contract has no hash-list or session filter, and building one would either change the VFS API or produce incomplete client-side filtering across pagination.

Session-specific history is deferred to the future `capture_events` work. The panel copy should say “打开媒体库” rather than implying a session-filtered view.

### D10 — Site auto-capture is deferred with an explicit precedence rule

When auto-capture is introduced later, a manual session always wins: auto-start is allowed only when no session is active. Rules will be stored in configuration and managed from the Settings tab. This change only records the precedence rule so the session model can support it without redesign.

## Risks / Trade-offs

- **Users lose the library in the Side Panel (BREAKING).** → The cockpit's summary and start states include a clear “打开媒体库” handoff; docs and the empty state point to Options.
- **Single session means switching capture tabs requires stopping the current one.** → The confirmation dialog names the session tab before stopping; passive tab switches keep the session and show the banner.
- **A session can keep capturing while the user is on another tab.** → The banner is persistent and includes a stop action; no hidden capture continues without a visible session state.
- **Service-worker suspension can lose the last fraction of the event log.** → Snapshot writes are throttled, the log is bounded, and the design accepts a small loss window; restarting the browser intentionally clears the session.
- **Page URL on an event may be the session's current page rather than the exact iframe/document URL.** → Each event also carries `sourceUrl`; the cockpit labels page identity as the session page. Exact frame attribution would require additional CDP frame tracking and is out of scope.
- **Content-hash deduplication means a duplicate belongs to more than one page.** → The cockpit records a duplicate event against the current session while pointing at the existing hash; it does not claim exclusive site ownership. Site history needs the future `capture_events` relation.
- **The Options library mixes Ant Design and custom media styles.** → Accepted for MVP; reuse the existing `useTheme` classes and full-width layout, and defer a design-token unification.
- **The library handoff cannot filter to the session.** → The action opens the global library; session filtering is explicitly deferred to the `capture_events` work.
- **Restricted pages cannot be captured or fully identified.** → Show an unsupported-page state with the available identity and no usable start action.

## Migration Plan

1. **Background session foundation** — add the session store, `capture:get-session`, single-session enforcement, session events, counters, bounded log, and `storage.session` snapshot. Keep existing capture rules and message protocols working.
2. **Side Panel cockpit** — replace the global library wiring in `sidepanel/App.tsx` with tab identity, session state, metrics, live feed, event log, summary, and handoff. Add the other-tab banner.
3. **Options console** — add hash-routed tabs, the Overview tab, regroup existing cards, and mount the media library with the shared components.
4. **Documentation and tests** — update `README.md`, `ARCHITECTURE.md`, and `packages/extension/README.md`; add unit tests for session transitions, counters, log bounding, and snapshot restore, plus component tests for the four panel states and the Options library.

No storage migration is required. Session snapshots use a new `chrome.storage.session` key and are cleared on browser restart. Rolling back is a revert of the extension UI and background code; VFS data is untouched, and any stale session snapshot expires with the browser session.

## Open Questions

- Should the session summary remain visible on another tab after the session tab is closed, or is it acceptable that the summary disappears with the tab? The current design keeps the snapshot but only presents a summary for a session tab that still exists.
- Should the Side Panel feed use a lightweight in-panel preview later, or is opening the original file in a new tab sufficient for the cockpit? The MVP uses the latter.
