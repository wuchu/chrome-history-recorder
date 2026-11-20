import { describe, expect, it, vi } from 'vitest';
import { createAppExternalHandler, type AppHandlerDependencies } from '../src/handlers';
import {
  MediaArchiveTargetError,
  type MediaArchiveConfigUpdate,
  type MediaArchiveStatus,
} from '../src/media-archive';

const status: MediaArchiveStatus = {
  enabled: true,
  targetPath: '/Volumes/archive',
  intervalMinutes: 5,
  running: false,
  pendingCount: 0,
  failedCount: 0,
};

function createHandler(overrides: Partial<AppHandlerDependencies['mediaArchive']> = {}): {
  handler: ReturnType<typeof createAppExternalHandler>;
  mediaArchive: AppHandlerDependencies['mediaArchive'];
} {
  const mediaArchive = {
    getStatus: vi.fn(() => status),
    updateConfig: vi.fn((_update: MediaArchiveConfigUpdate) => status),
    runNow: vi.fn(() => status),
    ...overrides,
  };

  const handler = createAppExternalHandler({
    api: {} as AppHandlerDependencies['api'],
    ai: {} as AppHandlerDependencies['ai'],
    store: {} as AppHandlerDependencies['store'],
    scheduler: {} as AppHandlerDependencies['scheduler'],
    events: {} as AppHandlerDependencies['events'],
    workspace: {
      getInfo: () => ({ path: '/workspace', defaultPath: '/workspace', source: 'default' }),
      setPath: () => ({ pendingPath: '/next' }),
    },
    mediaArchive,
  });

  return { handler, mediaArchive };
}

describe('app media archive handlers', () => {
  it('returns the current archive status', async () => {
    const { handler } = createHandler();
    await expect(handler('getMediaArchiveStatus', {})).resolves.toEqual(status);
  });

  it('forwards a valid configuration update', async () => {
    const { handler, mediaArchive } = createHandler();

    await expect(
      handler('updateMediaArchiveConfig', {
        enabled: true,
        targetPath: '/Volumes/archive',
        intervalMinutes: 15,
      })
    ).resolves.toEqual(status);

    expect(mediaArchive.updateConfig).toHaveBeenCalledWith({
      enabled: true,
      targetPath: '/Volumes/archive',
      intervalMinutes: 15,
    });
  });

  it('ignores parameters with the wrong type', async () => {
    const { handler, mediaArchive } = createHandler();

    await handler('updateMediaArchiveConfig', {
      enabled: 'yes',
      targetPath: 42,
      intervalMinutes: '15',
    });

    expect(mediaArchive.updateConfig).toHaveBeenCalledWith({
      enabled: undefined,
      targetPath: undefined,
      intervalMinutes: undefined,
    });
  });

  it('propagates target validation failures', async () => {
    const { handler } = createHandler({
      updateConfig: () => {
        throw new MediaArchiveTargetError('not-found', '归档目标目录不存在');
      },
    });

    await expect(
      handler('updateMediaArchiveConfig', { enabled: true, targetPath: '/missing' })
    ).rejects.toThrow('归档目标目录不存在');
  });

  it('runs a manual archive sweep', async () => {
    const { handler, mediaArchive } = createHandler();

    await expect(handler('runMediaArchiveNow', {})).resolves.toEqual(status);
    expect(mediaArchive.runNow).toHaveBeenCalledTimes(1);
  });

  it('falls through for methods owned by the storage layer', async () => {
    const { handler } = createHandler();
    await expect(handler('getStats', {})).resolves.toBeUndefined();
  });
});
