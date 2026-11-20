import { describe, expect, it, vi } from 'vitest';
import { createAppExternalHandler, type AppHandlerDependencies } from '../src/handlers';
import { WorkspaceConfigError, type WorkspaceInfo } from '../src/workspace-config';

const workspaceInfo: WorkspaceInfo = {
  path: '/current/workspace',
  defaultPath: '/default/workspace',
  source: 'config',
};

function createHandler(setPath: (target: string) => { pendingPath: string }) {
  const workspace = {
    getInfo: vi.fn(() => workspaceInfo),
    setPath: vi.fn(setPath),
  };

  const handler = createAppExternalHandler({
    api: {} as AppHandlerDependencies['api'],
    ai: {} as AppHandlerDependencies['ai'],
    store: {} as AppHandlerDependencies['store'],
    scheduler: {} as AppHandlerDependencies['scheduler'],
    events: {} as AppHandlerDependencies['events'],
    workspace,
    mediaArchive: {} as AppHandlerDependencies['mediaArchive'],
  });

  return { handler, workspace };
}

describe('app workspace handlers', () => {
  it('returns enriched workspace information', async () => {
    const { handler } = createHandler(() => ({ pendingPath: '/next' }));
    await expect(handler('getWorkspaceConfig', {})).resolves.toEqual(workspaceInfo);
  });

  it('saves a workspace path and reports that a restart is required', async () => {
    const { handler, workspace } = createHandler(() => ({ pendingPath: '/next/workspace' }));

    await expect(handler('setWorkspacePath', { path: '  /next/workspace  ' })).resolves.toEqual({
      success: true,
      restartRequired: true,
      pendingPath: '/next/workspace',
    });
    expect(workspace.setPath).toHaveBeenCalledWith('/next/workspace');
  });

  it('propagates validation failures', async () => {
    const { handler } = createHandler(() => {
      throw new WorkspaceConfigError('not-a-workspace', '目标目录非空且不是已有工作区');
    });

    await expect(handler('setWorkspacePath', { path: '/bad' })).rejects.toThrow(
      '目标目录非空且不是已有工作区'
    );
  });

  it('falls through for methods owned by the storage layer', async () => {
    const { handler } = createHandler(() => ({ pendingPath: '/next' }));
    await expect(handler('getStats', {})).resolves.toBeUndefined();
  });
});
