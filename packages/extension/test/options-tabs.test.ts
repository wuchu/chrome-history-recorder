import { describe, expect, it } from 'vitest';
import {
  consoleTabHash,
  isConsoleTab,
  readConsoleTabFromHash,
} from '../src/entrypoints/options/tabs';

describe('Options console tabs', () => {
  it('reads supported tabs from a hash', () => {
    expect(readConsoleTabFromHash('#overview')).toBe('overview');
    expect(readConsoleTabFromHash('#library')).toBe('library');
    expect(readConsoleTabFromHash('#settings')).toBe('settings');
  });

  it('ignores query parameters', () => {
    expect(readConsoleTabFromHash('#library?site=example.com')).toBe('library');
  });

  it('falls back to overview for unknown or missing hashes', () => {
    expect(readConsoleTabFromHash('')).toBe('overview');
    expect(readConsoleTabFromHash('#unknown')).toBe('overview');
  });

  it('validates console tab identifiers', () => {
    expect(isConsoleTab('tasks')).toBe(true);
    expect(isConsoleTab('unknown')).toBe(false);
  });

  it('formats a console tab hash', () => {
    expect(consoleTabHash('tags')).toBe('#tags');
  });
});
