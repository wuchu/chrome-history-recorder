import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES,
  MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES,
  MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES,
  normalizeAppConfig,
  type AppConfig,
} from '../src/types';

function configWith(overrides: Partial<AppConfig>): AppConfig {
  return { ...DEFAULT_APP_CONFIG, ...overrides };
}

describe('media archive configuration', () => {
  it('defaults to disabled with an empty target and a 5 minute interval', () => {
    expect(DEFAULT_APP_CONFIG.mediaArchiveEnabled).toBe(false);
    expect(DEFAULT_APP_CONFIG.mediaArchiveTargetPath).toBe('');
    expect(DEFAULT_APP_CONFIG.mediaArchiveIntervalMinutes).toBe(
      DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES
    );
  });

  it('fills archive fields when loading a legacy configuration', () => {
    const legacy = { ...DEFAULT_APP_CONFIG } as Partial<AppConfig>;
    delete legacy.mediaArchiveEnabled;
    delete legacy.mediaArchiveTargetPath;
    delete legacy.mediaArchiveIntervalMinutes;

    const normalized = normalizeAppConfig(legacy as AppConfig);

    expect(normalized.mediaArchiveEnabled).toBe(false);
    expect(normalized.mediaArchiveTargetPath).toBe('');
    expect(normalized.mediaArchiveIntervalMinutes).toBe(DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES);
  });

  it('clamps the interval into the supported range', () => {
    expect(
      normalizeAppConfig(configWith({ mediaArchiveIntervalMinutes: 0 })).mediaArchiveIntervalMinutes
    ).toBe(MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES);

    expect(
      normalizeAppConfig(configWith({ mediaArchiveIntervalMinutes: 9999 }))
        .mediaArchiveIntervalMinutes
    ).toBe(MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES);

    expect(
      normalizeAppConfig(configWith({ mediaArchiveIntervalMinutes: 12.7 }))
        .mediaArchiveIntervalMinutes
    ).toBe(12);
  });

  it('falls back to the default interval when the value is not finite', () => {
    expect(
      normalizeAppConfig(configWith({ mediaArchiveIntervalMinutes: Number.NaN }))
        .mediaArchiveIntervalMinutes
    ).toBe(DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES);
  });

  it('trims the target path', () => {
    const normalized = normalizeAppConfig(
      configWith({ mediaArchiveTargetPath: '  /Volumes/archive  ' })
    );

    expect(normalized.mediaArchiveTargetPath).toBe('/Volumes/archive');
  });

  it('coerces a non-boolean enabled flag to false', () => {
    const normalized = normalizeAppConfig(
      configWith({ mediaArchiveEnabled: 'yes' as unknown as boolean })
    );

    expect(normalized.mediaArchiveEnabled).toBe(false);
  });
});
