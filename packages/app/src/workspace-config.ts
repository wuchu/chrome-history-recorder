/**
 * Workspace path resolution and launcher configuration.
 *
 * The workspace path must be known before the workspace is opened, so it
 * cannot live in `workspace/config.json`. This module owns the user-level
 * launcher configuration and the validation rules shared by the save RPC and
 * the startup path.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ensureWorkspace,
  expandPath,
  getDefaultWorkspacePath,
  parseArgs,
  type WorkspaceSource,
} from 'vfs';

const APP_DIR_NAME = 'browser-media-recorder';
const LAUNCHER_CONFIG_VERSION = 1;

export type AppWorkspaceSource = WorkspaceSource | 'config';

export interface LauncherConfig {
  version: number;
  workspacePath: string;
}

export interface WorkspaceResolution {
  workspacePath: string;
  defaultPath: string;
  source: AppWorkspaceSource;
  launcherConfigPath: string;
}

export interface WorkspaceInfo {
  path: string;
  defaultPath: string;
  source: AppWorkspaceSource;
  pendingPath?: string;
}

export type WorkspaceErrorCode =
  | 'invalid-path'
  | 'forbidden-path'
  | 'parent-missing'
  | 'not-writable'
  | 'not-a-directory'
  | 'not-a-workspace'
  | 'volume-missing'
  | 'override-active';

export class WorkspaceConfigError extends Error {
  readonly code: WorkspaceErrorCode;

  constructor(code: WorkspaceErrorCode, messageText: string) {
    super(messageText);
    this.name = 'WorkspaceConfigError';
    this.code = code;
  }
}

export interface WorkspaceOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  launcherConfigPath?: string;
}

export interface ValidateWorkspaceOptions extends WorkspaceOptions {
  currentPath?: string;
}

export interface WorkspaceUpdateResult {
  pendingPath: string;
}

/**
 * Resolve the platform-specific launcher configuration path.
 */
export function getLauncherConfigPath(options: WorkspaceOptions = {}): string {
  if (options.launcherConfigPath) {
    return options.launcherConfigPath;
  }

  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const home = os.homedir();

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', APP_DIR_NAME, 'config.json');
  }

  if (platform === 'win32') {
    const appData = env.APPDATA?.trim() || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, APP_DIR_NAME, 'config.json');
  }

  const configHome = env.XDG_CONFIG_HOME?.trim() || path.join(home, '.config');
  return path.join(configHome, APP_DIR_NAME, 'config.json');
}

/**
 * Read the launcher configuration. Missing, malformed, or unreadable files
 * are treated as "not configured" so startup is never blocked by this file.
 */
export function readLauncherConfig(configPath = getLauncherConfigPath()): LauncherConfig | null {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<LauncherConfig>;
    const workspacePath =
      typeof parsed.workspacePath === 'string' ? parsed.workspacePath.trim() : '';
    if (!workspacePath) {
      return null;
    }

    return {
      version: typeof parsed.version === 'number' ? parsed.version : LAUNCHER_CONFIG_VERSION,
      workspacePath,
    };
  } catch (error) {
    console.warn(`[Workspace] Failed to read launcher config at ${configPath}:`, error);
    return null;
  }
}

/**
 * Atomically persist the launcher configuration.
 */
export function writeLauncherConfig(
  workspacePath: string,
  configPath = getLauncherConfigPath()
): void {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });

  const tempPath = path.join(dir, `.${path.basename(configPath)}.${process.pid}.${Date.now()}.tmp`);
  const payload: LauncherConfig = {
    version: LAUNCHER_CONFIG_VERSION,
    workspacePath,
  };

  try {
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, configPath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      console.warn('[Workspace] Failed to clean up temporary config file:', cleanupError);
    }
    throw error;
  }
}

/**
 * Resolve the workspace path using CLI, environment, launcher configuration,
 * then the default path.
 */
export function resolveWorkspace(
  argv: string[],
  options: WorkspaceOptions = {}
): WorkspaceResolution {
  const env = options.env ?? process.env;
  const launcherConfigPath = getLauncherConfigPath(options);
  const defaultPath = getDefaultWorkspacePath();
  const parsed = parseArgs(argv, env);

  if (parsed.source !== 'default') {
    return {
      workspacePath: parsed.workspacePath,
      defaultPath,
      source: parsed.source,
      launcherConfigPath,
    };
  }

  const launcher = readLauncherConfig(launcherConfigPath);
  if (launcher) {
    return {
      workspacePath: expandPath(launcher.workspacePath),
      defaultPath,
      source: 'config',
      launcherConfigPath,
    };
  }

  return {
    workspacePath: parsed.workspacePath,
    defaultPath,
    source: 'default',
    launcherConfigPath,
  };
}

function comparisonKey(value: string, platform: NodeJS.Platform): string {
  const resolved = path.resolve(value);
  return platform === 'darwin' || platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertWritable(target: string, messageText: string): void {
  try {
    fs.accessSync(target, fs.constants.W_OK);
  } catch {
    throw new WorkspaceConfigError('not-writable', messageText);
  }
}

/**
 * Validate a candidate workspace path. Returns the normalized absolute path.
 *
 * When `currentPath` is provided, paths equal to or inside the running
 * workspace are rejected. Startup validation omits it because the candidate is
 * the workspace being opened.
 */
export function validateWorkspaceTarget(
  target: string,
  options: ValidateWorkspaceOptions = {}
): string {
  const platform = options.platform ?? process.platform;
  const raw = target.trim();
  if (!raw) {
    throw new WorkspaceConfigError('invalid-path', '请输入工作区绝对路径');
  }

  const expanded = expandPath(raw);
  if (!path.isAbsolute(expanded)) {
    throw new WorkspaceConfigError('invalid-path', '工作区路径必须是绝对路径');
  }

  const resolved = path.resolve(expanded);
  const key = comparisonKey(resolved, platform);

  if (key === comparisonKey(path.parse(resolved).root, platform)) {
    throw new WorkspaceConfigError('forbidden-path', '不能把文件系统根目录作为工作区');
  }
  if (key === comparisonKey(os.homedir(), platform)) {
    throw new WorkspaceConfigError('forbidden-path', '不能把用户主目录本身作为工作区');
  }

  if (options.currentPath) {
    const currentKey = comparisonKey(options.currentPath, platform);
    if (key === currentKey) {
      throw new WorkspaceConfigError('forbidden-path', '新路径与当前工作区相同');
    }

    const relative = path.relative(currentKey, key);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      throw new WorkspaceConfigError('forbidden-path', '新路径不能位于当前工作区内部');
    }
  }

  if (platform === 'darwin' && resolved.startsWith(`/Volumes/`)) {
    const volumeName = resolved.slice('/Volumes/'.length).split('/')[0];
    const volumeRoot = path.join('/Volumes', volumeName);
    if (!fs.existsSync(volumeRoot)) {
      throw new WorkspaceConfigError('volume-missing', `外置卷 ${volumeRoot} 未挂载`);
    }
  }

  let stats: fs.Stats | null = null;
  try {
    stats = fs.statSync(resolved);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw new WorkspaceConfigError(
        'invalid-path',
        `无法访问目标路径：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (stats) {
    if (!stats.isDirectory()) {
      throw new WorkspaceConfigError('not-a-directory', '目标路径不是目录');
    }

    assertWritable(resolved, '目标目录不可写');

    const entries = fs.readdirSync(resolved).filter((entry) => entry !== '.DS_Store');
    if (entries.length === 0) {
      return resolved;
    }

    const dbPath = path.join(resolved, 'vfs.db');
    if (fs.existsSync(dbPath) && fs.statSync(dbPath).isFile()) {
      try {
        fs.accessSync(dbPath, fs.constants.R_OK);
      } catch {
        throw new WorkspaceConfigError('not-a-workspace', `工作区数据库不可读：${dbPath}`);
      }
      return resolved;
    }

    throw new WorkspaceConfigError(
      'not-a-workspace',
      '目标目录非空且不是已有工作区（缺少 vfs.db）'
    );
  }

  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    throw new WorkspaceConfigError('parent-missing', `目标目录的父目录不存在：${parent}`);
  }
  assertWritable(parent, `目标目录的父目录不可写：${parent}`);

  return resolved;
}

/**
 * Describe the current workspace and any path that will apply after restart.
 */
export function getWorkspaceInfo(
  resolution: WorkspaceResolution,
  options: WorkspaceOptions = {}
): WorkspaceInfo {
  const platform = options.platform ?? process.platform;
  const info: WorkspaceInfo = {
    path: resolution.workspacePath,
    defaultPath: resolution.defaultPath,
    source: resolution.source,
  };

  if (resolution.source === 'cli' || resolution.source === 'env') {
    return info;
  }

  const launcher = readLauncherConfig(resolution.launcherConfigPath);
  if (!launcher) {
    return info;
  }

  const pending = expandPath(launcher.workspacePath);
  if (comparisonKey(pending, platform) !== comparisonKey(resolution.workspacePath, platform)) {
    info.pendingPath = pending;
  }

  return info;
}

/**
 * Validate and persist a new workspace path. The running workspace is not
 * changed; the caller reports that a restart is required.
 */
export function updateWorkspacePath(
  target: string,
  resolution: WorkspaceResolution,
  options: WorkspaceOptions = {}
): WorkspaceUpdateResult {
  if (resolution.source === 'cli' || resolution.source === 'env') {
    throw new WorkspaceConfigError(
      'override-active',
      '当前工作区由启动参数或环境变量指定，Options 修改不会生效'
    );
  }

  const validated = validateWorkspaceTarget(target, {
    ...options,
    currentPath: resolution.workspacePath,
  });
  writeLauncherConfig(validated, resolution.launcherConfigPath);
  return { pendingPath: validated };
}

/**
 * Validate and create the workspace for startup. Throws when the configured
 * workspace is unusable so the caller can fail fast.
 */
export function prepareWorkspaceAtStartup(
  resolution: WorkspaceResolution,
  options: WorkspaceOptions = {}
): string {
  const validated = validateWorkspaceTarget(resolution.workspacePath, options);
  ensureWorkspace(validated);
  return validated;
}

const SOURCE_LABELS: Record<AppWorkspaceSource, string> = {
  cli: '启动参数 (--workspace)',
  env: '环境变量 (VFS_WORKSPACE)',
  config: 'launcher 配置',
  default: '默认值',
};

export function describeWorkspaceSource(source: AppWorkspaceSource): string {
  return SOURCE_LABELS[source];
}

/**
 * Build the startup failure message with recovery instructions.
 */
export function formatWorkspaceStartupError(
  resolution: WorkspaceResolution,
  error: unknown
): string {
  const reason = error instanceof Error ? error.message : String(error);
  return [
    `无法使用工作区：${resolution.workspacePath}`,
    `原因：${reason}`,
    `配置来源：${describeWorkspaceSource(resolution.source)}`,
    `launcher 配置：${resolution.launcherConfigPath}`,
    `默认路径：${resolution.defaultPath}`,
    '恢复方式：',
    '  1. 确认路径存在且可访问（外置磁盘请先挂载）后重新启动',
    '  2. 或使用 --workspace <path> 临时指定其他工作区',
    `  3. 或移除 --workspace / VFS_WORKSPACE / launcher 配置中的自定义路径，回到默认 ${resolution.defaultPath}`,
  ].join('\n');
}
