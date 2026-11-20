import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  WorkspaceConfigError,
  formatWorkspaceStartupError,
  getLauncherConfigPath,
  getWorkspaceInfo,
  prepareWorkspaceAtStartup,
  readLauncherConfig,
  resolveWorkspace,
  updateWorkspacePath,
  validateWorkspaceTarget,
  writeLauncherConfig,
  type WorkspaceResolution,
} from '../src/workspace-config';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-config-'));
  tempDirs.push(dir);
  return dir;
}

function workspaceResolution(
  workspacePath: string,
  launcherConfigPath: string,
  source: WorkspaceResolution['source'] = 'config'
): WorkspaceResolution {
  return {
    workspacePath,
    defaultPath: path.join(os.homedir(), '.vfs-workspace'),
    source,
    launcherConfigPath,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.chmodSync(dir, 0o755);
    } catch {
      // ignore
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('launcher configuration', () => {
  it('resolves platform-specific paths', () => {
    expect(getLauncherConfigPath({ platform: 'darwin' })).toBe(
      path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'browser-media-recorder',
        'config.json'
      )
    );
    expect(getLauncherConfigPath({ platform: 'linux', env: { XDG_CONFIG_HOME: '/xdg' } })).toBe(
      path.join('/xdg', 'browser-media-recorder', 'config.json')
    );
    expect(getLauncherConfigPath({ platform: 'win32', env: { APPDATA: 'C:\\AppData' } })).toBe(
      path.join('C:\\AppData', 'browser-media-recorder', 'config.json')
    );
    expect(getLauncherConfigPath({ launcherConfigPath: '/custom/config.json' })).toBe(
      '/custom/config.json'
    );
  });

  it('writes and reads the launcher configuration atomically', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'nested', 'config.json');

    writeLauncherConfig('/media/workspace', configPath);

    expect(JSON.parse(fs.readFileSync(configPath, 'utf-8'))).toEqual({
      version: 1,
      workspacePath: '/media/workspace',
    });
    expect(readLauncherConfig(configPath)).toEqual({
      version: 1,
      workspacePath: '/media/workspace',
    });
    expect(fs.readdirSync(path.dirname(configPath))).toEqual(['config.json']);
  });

  it('treats missing and malformed configuration as unconfigured', () => {
    const dir = makeTempDir();
    const missing = path.join(dir, 'missing.json');
    expect(readLauncherConfig(missing)).toBeNull();

    const malformed = path.join(dir, 'malformed.json');
    fs.writeFileSync(malformed, '{not json');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(readLauncherConfig(malformed)).toBeNull();

    const empty = path.join(dir, 'empty.json');
    fs.writeFileSync(empty, JSON.stringify({ version: 1 }));
    expect(readLauncherConfig(empty)).toBeNull();
  });
});

describe('resolveWorkspace', () => {
  it('falls back to the default path', () => {
    const dir = makeTempDir();
    const resolution = resolveWorkspace([], {
      env: {},
      launcherConfigPath: path.join(dir, 'config.json'),
    });

    expect(resolution.source).toBe('default');
    expect(resolution.workspacePath).toBe(path.join(os.homedir(), '.vfs-workspace'));
  });

  it('uses the launcher configuration when no override is present', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'config.json');
    writeLauncherConfig('/launcher/workspace', configPath);

    const resolution = resolveWorkspace([], { env: {}, launcherConfigPath: configPath });
    expect(resolution.source).toBe('config');
    expect(resolution.workspacePath).toBe('/launcher/workspace');
  });

  it('expands a tilde in the launcher configuration', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'config.json');
    writeLauncherConfig('~/media', configPath);

    const resolution = resolveWorkspace([], { env: {}, launcherConfigPath: configPath });
    expect(resolution.workspacePath).toBe(path.join(os.homedir(), 'media'));
  });

  it('prefers environment and CLI over the launcher configuration', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'config.json');
    writeLauncherConfig('/launcher/workspace', configPath);

    const fromEnv = resolveWorkspace([], {
      env: { VFS_WORKSPACE: '/env/workspace' },
      launcherConfigPath: configPath,
    });
    expect(fromEnv.source).toBe('env');
    expect(fromEnv.workspacePath).toBe('/env/workspace');

    const fromCli = resolveWorkspace(['-w', '/cli/workspace'], {
      env: { VFS_WORKSPACE: '/env/workspace' },
      launcherConfigPath: configPath,
    });
    expect(fromCli.source).toBe('cli');
    expect(fromCli.workspacePath).toBe('/cli/workspace');
  });
});

describe('validateWorkspaceTarget', () => {
  it('rejects relative, root, and home paths', () => {
    expect(() => validateWorkspaceTarget('relative/path')).toThrow(WorkspaceConfigError);
    expect(() => validateWorkspaceTarget('/')).toThrow(WorkspaceConfigError);
    expect(() => validateWorkspaceTarget(os.homedir())).toThrow(WorkspaceConfigError);
  });

  it('rejects the current workspace and paths inside it', () => {
    const dir = makeTempDir();
    expect(() => validateWorkspaceTarget(dir, { currentPath: dir })).toThrow(/相同/);
    expect(() => validateWorkspaceTarget(path.join(dir, 'blobs'), { currentPath: dir })).toThrow(
      /内部/
    );
  });

  it('requires an existing writable parent', () => {
    expect(() => validateWorkspaceTarget('/nonexistent-parent-xyz/workspace')).toThrow(
      /父目录不存在/
    );
  });

  it('rejects a non-directory target', () => {
    const dir = makeTempDir();
    const file = path.join(dir, 'file.txt');
    fs.writeFileSync(file, 'x');
    expect(() => validateWorkspaceTarget(file)).toThrow(/不是目录/);
  });

  it('accepts empty directories, including .DS_Store only', () => {
    const dir = makeTempDir();
    expect(validateWorkspaceTarget(dir)).toBe(dir);

    const withDsStore = makeTempDir();
    fs.writeFileSync(path.join(withDsStore, '.DS_Store'), '');
    expect(validateWorkspaceTarget(withDsStore)).toBe(withDsStore);
  });

  it('accepts an existing workspace and rejects other non-empty directories', () => {
    const existing = makeTempDir();
    fs.writeFileSync(path.join(existing, 'vfs.db'), '');
    expect(validateWorkspaceTarget(existing)).toBe(existing);

    const nonWorkspace = makeTempDir();
    fs.writeFileSync(path.join(nonWorkspace, 'random.txt'), 'x');
    expect(() => validateWorkspaceTarget(nonWorkspace)).toThrow(/不是已有工作区/);
  });

  it('reports an unmounted external volume on macOS', () => {
    expect(() =>
      validateWorkspaceTarget('/Volumes/definitely-not-mounted/workspace', {
        platform: 'darwin',
      })
    ).toThrow(/未挂载/);
  });

  it('rejects a read-only directory', () => {
    const dir = makeTempDir();
    const locked = path.join(dir, 'locked');
    fs.mkdirSync(locked);
    fs.chmodSync(locked, 0o555);

    try {
      expect(() => validateWorkspaceTarget(locked)).toThrow(/不可写/);
    } finally {
      fs.chmodSync(locked, 0o755);
    }
  });
});

describe('workspace info and updates', () => {
  it('reports a pending path when the launcher config differs', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'config.json');
    const resolution = workspaceResolution('/current/workspace', configPath);
    writeLauncherConfig('/next/workspace', configPath);

    expect(getWorkspaceInfo(resolution)).toEqual({
      path: '/current/workspace',
      defaultPath: resolution.defaultPath,
      source: 'config',
      pendingPath: '/next/workspace',
    });
  });

  it('does not report a pending path under CLI or environment override', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'config.json');
    writeLauncherConfig('/next/workspace', configPath);

    const info = getWorkspaceInfo(workspaceResolution('/cli/workspace', configPath, 'cli'));
    expect(info.pendingPath).toBeUndefined();
  });

  it('saves a valid path and leaves the running workspace untouched', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'config.json');
    const target = makeTempDir();
    const resolution = workspaceResolution(path.join(dir, 'current'), configPath);

    const result = updateWorkspacePath(target, resolution);

    expect(result).toEqual({ pendingPath: target });
    expect(readLauncherConfig(configPath)?.workspacePath).toBe(target);
    expect(resolution.workspacePath).toBe(path.join(dir, 'current'));
  });

  it('does not write the launcher config when validation fails', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'config.json');
    const resolution = workspaceResolution(path.join(dir, 'current'), configPath);
    writeLauncherConfig('/original/workspace', configPath);

    expect(() => updateWorkspacePath('relative/path', resolution)).toThrow(WorkspaceConfigError);
    expect(readLauncherConfig(configPath)?.workspacePath).toBe('/original/workspace');
  });

  it('rejects updates under CLI or environment override', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'config.json');
    const target = makeTempDir();

    expect(() =>
      updateWorkspacePath(target, workspaceResolution('/cli/workspace', configPath, 'cli'))
    ).toThrow(/启动参数|环境变量/);
    expect(() =>
      updateWorkspacePath(target, workspaceResolution('/env/workspace', configPath, 'env'))
    ).toThrow(/启动参数|环境变量/);
  });
});

describe('startup preparation', () => {
  it('creates workspace directories for a new path', () => {
    const dir = makeTempDir();
    const target = path.join(dir, 'workspace');
    const configPath = path.join(dir, 'config.json');

    const prepared = prepareWorkspaceAtStartup(workspaceResolution(target, configPath));

    expect(prepared).toBe(target);
    expect(fs.existsSync(path.join(target, 'blobs'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'thumbnails'))).toBe(true);
  });

  it('fails for a non-empty non-workspace directory', () => {
    const dir = makeTempDir();
    const target = makeTempDir();
    fs.writeFileSync(path.join(target, 'random.txt'), 'x');

    expect(() =>
      prepareWorkspaceAtStartup(workspaceResolution(target, path.join(dir, 'config.json')))
    ).toThrow(/不是已有工作区/);
  });

  it('formats a startup error with recovery guidance', () => {
    const dir = makeTempDir();
    const resolution = workspaceResolution('/missing/workspace', path.join(dir, 'config.json'));
    const message = formatWorkspaceStartupError(
      resolution,
      new WorkspaceConfigError('parent-missing', '父目录不存在')
    );

    expect(message).toContain('/missing/workspace');
    expect(message).toContain('父目录不存在');
    expect(message).toContain('launcher 配置');
    expect(message).toContain('--workspace');
    expect(message).toContain(resolution.defaultPath);
  });
});
