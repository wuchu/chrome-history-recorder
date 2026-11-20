export const CONSOLE_TABS = ['overview', 'library', 'tags', 'tasks', 'settings'] as const;

export type ConsoleTab = (typeof CONSOLE_TABS)[number];

export function isConsoleTab(value: string): value is ConsoleTab {
  return (CONSOLE_TABS as readonly string[]).includes(value);
}

/**
 * Resolve the console tab from a location hash such as `#library` or
 * `#library?site=x`. Unknown or missing values fall back to Overview.
 */
export function readConsoleTabFromHash(hash: string): ConsoleTab {
  const raw = hash.replace(/^#/, '').split('?')[0];
  return isConsoleTab(raw) ? raw : 'overview';
}

export function consoleTabHash(tab: ConsoleTab): string {
  return `#${tab}`;
}
