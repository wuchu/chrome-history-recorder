import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_MEDIA_ARCHIVE_INTERVAL_MINUTES,
  DEFAULT_TASK_CONCURRENCY,
  DEFAULT_VIDEO_CAPTURE_MODE,
  DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST,
  MAX_MEDIA_ARCHIVE_INTERVAL_MINUTES,
  MAX_TASK_CONCURRENCY,
  MIN_MEDIA_ARCHIVE_INTERVAL_MINUTES,
  MIN_TASK_CONCURRENCY,
  migrateLegacyScheduling,
  normalizeAppConfig,
  normalizeVideoCaptureModeByHost,
  type AppConfig,
} from '../src/types';
import { ConfigStore } from '../src/config-store';

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

describe('task concurrency configuration', () => {
  it('defaults each concurrency to one and both AI task types to paused', () => {
    expect(DEFAULT_APP_CONFIG.ollamaMaxConcurrency).toBe(DEFAULT_TASK_CONCURRENCY);
    expect(DEFAULT_APP_CONFIG.classifyConcurrency).toBe(DEFAULT_TASK_CONCURRENCY);
    expect(DEFAULT_APP_CONFIG.renameConcurrency).toBe(DEFAULT_TASK_CONCURRENCY);
    expect(DEFAULT_APP_CONFIG.mediaArchiveConcurrency).toBe(DEFAULT_TASK_CONCURRENCY);
    expect(DEFAULT_APP_CONFIG.classifyPaused).toBe(true);
    expect(DEFAULT_APP_CONFIG.renamePaused).toBe(true);
  });

  it('clamps per-task concurrency into the supported range', () => {
    const normalized = normalizeAppConfig(
      configWith({
        ollamaMaxConcurrency: 0,
        classifyConcurrency: 99,
        renameConcurrency: 3.9,
        mediaArchiveConcurrency: Number.NaN,
      })
    );

    expect(normalized.ollamaMaxConcurrency).toBe(MIN_TASK_CONCURRENCY);
    expect(normalized.classifyConcurrency).toBe(MAX_TASK_CONCURRENCY);
    expect(normalized.renameConcurrency).toBe(3);
    expect(normalized.mediaArchiveConcurrency).toBe(DEFAULT_TASK_CONCURRENCY);
  });

  it('migrates legacy global scheduling fields', () => {
    const migrated = migrateLegacyScheduling({
      classificationConcurrency: 4,
      classificationPaused: false,
    });

    expect(migrated.ollamaMaxConcurrency).toBe(4);
    expect(migrated.classifyPaused).toBe(false);
    expect(migrated.renamePaused).toBe(false);
    expect('classificationConcurrency' in migrated).toBe(false);
    expect('classificationPaused' in migrated).toBe(false);
  });

  it('prefers new fields over legacy fields', () => {
    const migrated = migrateLegacyScheduling({
      classificationConcurrency: 4,
      classificationPaused: true,
      ollamaMaxConcurrency: 2,
      classifyPaused: false,
      renamePaused: false,
    });

    expect(migrated.ollamaMaxConcurrency).toBe(2);
    expect(migrated.classifyPaused).toBe(false);
    expect(migrated.renamePaused).toBe(false);
  });

  it('does not let defaults shadow a legacy running state', () => {
    const migrated = migrateLegacyScheduling({ classificationPaused: false });
    const normalized = normalizeAppConfig({
      ...DEFAULT_APP_CONFIG,
      ...migrated,
    } as AppConfig);

    expect(normalized.classifyPaused).toBe(false);
    expect(normalized.renamePaused).toBe(false);
  });

  it('loads a legacy config.json and persists only new scheduling fields', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'app-config-migration-'));
    try {
      fs.writeFileSync(
        path.join(workspace, 'config.json'),
        JSON.stringify({
          ollamaEndpoint: 'http://localhost:11434',
          classificationConcurrency: 4,
          classificationPaused: false,
        })
      );

      const store = new ConfigStore(workspace);
      const loaded = store.load();

      expect(loaded.ollamaMaxConcurrency).toBe(4);
      expect(loaded.classifyPaused).toBe(false);
      expect(loaded.renamePaused).toBe(false);

      store.update({ language: 'en-US' });
      const persisted = JSON.parse(
        fs.readFileSync(path.join(workspace, 'config.json'), 'utf-8')
      ) as Record<string, unknown>;
      expect(persisted.ollamaMaxConcurrency).toBe(4);
      expect(persisted.classificationConcurrency).toBeUndefined();
      expect(persisted.classificationPaused).toBeUndefined();
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe('video capture mode configuration', () => {
  it('defaults to re-download with Douyin overrides', () => {
    expect(DEFAULT_APP_CONFIG.videoCaptureMode).toBe(DEFAULT_VIDEO_CAPTURE_MODE);
    expect(DEFAULT_APP_CONFIG.videoCaptureModeByHost).toEqual(DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST);
    expect(DEFAULT_APP_CONFIG.videoCaptureModeByHost['douyin.com']).toBe('buffer-only');
  });

  it('rejects unknown modes and falls back to the global default', () => {
    const normalized = normalizeAppConfig(
      configWith({ videoCaptureMode: 'unknown' as unknown as AppConfig['videoCaptureMode'] })
    );
    expect(normalized.videoCaptureMode).toBe(DEFAULT_VIDEO_CAPTURE_MODE);
  });

  it('normalizes host suffixes and drops invalid entries', () => {
    const normalized = normalizeVideoCaptureModeByHost({
      '*.Example.COM': 'buffer-only',
      '.douyin.com': 're-download',
      invalid: 'sometimes',
      '': 'buffer-only',
    });

    expect(normalized).toEqual({
      'example.com': 'buffer-only',
      'douyin.com': 're-download',
    });
  });

  it('defaults optional gap filling to on and preserves an explicit opt-out', () => {
    expect(DEFAULT_APP_CONFIG.videoAssemblyFillGaps).toBe(true);
    expect(
      normalizeAppConfig(configWith({ videoAssemblyFillGaps: false })).videoAssemblyFillGaps
    ).toBe(false);

    const legacy = { ...DEFAULT_APP_CONFIG } as Partial<AppConfig>;
    delete legacy.videoAssemblyFillGaps;
    expect(normalizeAppConfig(legacy as AppConfig).videoAssemblyFillGaps).toBe(true);

    expect(
      normalizeAppConfig(configWith({ videoAssemblyFillGaps: 'yes' as unknown as boolean }))
        .videoAssemblyFillGaps
    ).toBe(true);
  });

  it('accepts an empty override map', () => {
    expect(normalizeVideoCaptureModeByHost({})).toEqual({});
  });

  it('falls back to the built-in overrides for non-object values', () => {
    expect(normalizeVideoCaptureModeByHost(null)).toEqual(DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST);
    expect(normalizeVideoCaptureModeByHost('douyin.com')).toEqual(
      DEFAULT_VIDEO_CAPTURE_MODE_BY_HOST
    );
  });
});
