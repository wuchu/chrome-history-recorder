import { describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { expandPath, getDefaultWorkspacePath, parseArgs } from '../src/config';

describe('VFS workspace configuration', () => {
  it('falls back to the default workspace when nothing is configured', () => {
    const config = parseArgs([], {});
    expect(config).toEqual({
      workspacePath: path.join(os.homedir(), '.vfs-workspace'),
      source: 'default',
    });
  });

  it('parses -w and --workspace arguments', () => {
    expect(parseArgs(['-w', '/custom/one'], {}).workspacePath).toBe('/custom/one');
    expect(parseArgs(['--workspace', '/custom/two'], {}).workspacePath).toBe('/custom/two');
    expect(parseArgs(['--workspace', '/custom/two'], {}).source).toBe('cli');
  });

  it('reads VFS_WORKSPACE from the environment', () => {
    const config = parseArgs([], { VFS_WORKSPACE: '/env/workspace' });
    expect(config.workspacePath).toBe('/env/workspace');
    expect(config.source).toBe('env');
  });

  it('prefers CLI arguments over the environment', () => {
    const config = parseArgs(['-w', '/cli/workspace'], {
      VFS_WORKSPACE: '/env/workspace',
    });
    expect(config.workspacePath).toBe('/cli/workspace');
    expect(config.source).toBe('cli');
  });

  it('ignores an empty environment value', () => {
    const config = parseArgs([], { VFS_WORKSPACE: '   ' });
    expect(config.source).toBe('default');
    expect(config.workspacePath).toBe(getDefaultWorkspacePath());
  });

  it('ignores a workspace flag without a value', () => {
    const config = parseArgs(['--workspace'], {});
    expect(config.source).toBe('default');
    expect(config.workspacePath).toBe(getDefaultWorkspacePath());
  });

  it('expands a leading tilde', () => {
    expect(expandPath('~/media')).toBe(path.join(os.homedir(), 'media'));
    expect(parseArgs(['-w', '~/media'], {}).workspacePath).toBe(path.join(os.homedir(), 'media'));
  });
});
