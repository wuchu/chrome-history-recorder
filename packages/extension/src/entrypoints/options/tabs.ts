export const CONSOLE_TABS = ['overview', 'library', 'tags', 'tasks', 'settings'] as const;

export type ConsoleTab = (typeof CONSOLE_TABS)[number];

export type LibraryView = 'active' | 'trash';

export interface ConsoleRoute {
  tab: ConsoleTab;
  view: LibraryView;
}

export function isConsoleTab(value: string): value is ConsoleTab {
  return (CONSOLE_TABS as readonly string[]).includes(value);
}

export function isLibraryView(value: string): value is LibraryView {
  return value === 'active' || value === 'trash';
}

/**
 * Resolve the console route from a location hash.
 *
 * Supported forms:
 * - `#overview`, `#library`, `#tags`, `#tasks`, `#settings`
 * - `#library?view=trash`
 * - `#trash` (legacy deep link, maps to the library trash view)
 *
 * Unknown or missing values fall back to Overview.
 */
export function readConsoleRouteFromHash(hash: string): ConsoleRoute {
  const raw = hash.replace(/^#/, '');
  const [path, query = ''] = raw.split('?');

  if (path === 'trash') {
    return { tab: 'library', view: 'trash' };
  }

  if (!isConsoleTab(path)) {
    return { tab: 'overview', view: 'active' };
  }

  if (path !== 'library') {
    return { tab: path, view: 'active' };
  }

  const view = new URLSearchParams(query).get('view');
  return { tab: 'library', view: view === 'trash' ? 'trash' : 'active' };
}

export function readConsoleTabFromHash(hash: string): ConsoleTab {
  return readConsoleRouteFromHash(hash).tab;
}

export function consoleTabHash(tab: ConsoleTab, view: LibraryView = 'active'): string {
  if (tab === 'library' && view === 'trash') {
    return '#library?view=trash';
  }
  return `#${tab}`;
}
