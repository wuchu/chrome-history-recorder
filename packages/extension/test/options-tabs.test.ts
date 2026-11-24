import { describe, expect, it } from 'vitest';
import {
  consoleTabHash,
  isConsoleTab,
  readConsoleRouteFromHash,
  readConsoleTabFromHash,
} from '../src/entrypoints/options/tabs';

describe('Options console tabs', () => {
  it('reads supported tabs from a hash', () => {
    expect(readConsoleTabFromHash('#overview')).toBe('overview');
    expect(readConsoleTabFromHash('#library')).toBe('library');
    expect(readConsoleTabFromHash('#tags')).toBe('tags');
    expect(readConsoleTabFromHash('#tasks')).toBe('tasks');
    expect(readConsoleTabFromHash('#settings')).toBe('settings');
  });

  it('maps the legacy trash hash to the library trash view', () => {
    expect(readConsoleRouteFromHash('#trash')).toEqual({ tab: 'library', view: 'trash' });
    expect(readConsoleTabFromHash('#trash')).toBe('library');
  });

  it('reads the library view from the query string', () => {
    expect(readConsoleRouteFromHash('#library?view=trash')).toEqual({
      tab: 'library',
      view: 'trash',
    });
    expect(readConsoleRouteFromHash('#library?view=active')).toEqual({
      tab: 'library',
      view: 'active',
    });
    expect(readConsoleRouteFromHash('#library?site=example.com')).toEqual({
      tab: 'library',
      view: 'active',
    });
  });

  it('falls back to overview for unknown or missing hashes', () => {
    expect(readConsoleRouteFromHash('')).toEqual({ tab: 'overview', view: 'active' });
    expect(readConsoleRouteFromHash('#unknown')).toEqual({ tab: 'overview', view: 'active' });
  });

  it('validates console tab identifiers', () => {
    expect(isConsoleTab('tasks')).toBe(true);
    expect(isConsoleTab('trash')).toBe(false);
    expect(isConsoleTab('unknown')).toBe(false);
  });

  it('formats console hashes', () => {
    expect(consoleTabHash('tags')).toBe('#tags');
    expect(consoleTabHash('library')).toBe('#library');
    expect(consoleTabHash('library', 'trash')).toBe('#library?view=trash');
  });
});
