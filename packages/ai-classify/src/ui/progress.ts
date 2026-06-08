/**
 * AI Classify - Progress Visualization UI
 */

import cliProgress from 'cli-progress';
import chalk from 'chalk';
import boxen from 'boxen';
import logUpdate from 'log-update';
import { COLORS, ICONS, PROGRESS_CHARS } from './styles.js';
import { truncate, formatConfidence, confidenceBar } from './utils.js';

interface QueueState {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

interface CurrentTask {
  path: string;
  hash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  category?: string;
  filename?: string;
  confidence?: number;
  error?: string;
}

/**
 * Progress UI Controller
 */
export class ProgressUI {
  private multiBar: cliProgress.MultiBar;
  private pendingBar: cliProgress.SingleBar;
  private completedBar: cliProgress.SingleBar;
  private failedBar: cliProgress.SingleBar;
  private overallBar: cliProgress.SingleBar;
  private currentTasks: CurrentTask[] = [];
  private verboseMode: boolean = false;
  private quietMode: boolean = false;

  constructor(total: number, _concurrency: number) {
    // Create multi-progress bar container
    this.multiBar = new cliProgress.MultiBar({
      format: `{status} |{bar}| {value}/{total}`,
      barCompleteChar: PROGRESS_CHARS.complete,
      barIncompleteChar: PROGRESS_CHARS.incomplete,
      hideCursor: true,
    });

    // Create individual bars
    this.pendingBar = this.multiBar.create(total, 0, {
      status: COLORS.warning('Pending'),
    });

    this.completedBar = this.multiBar.create(total, 0, {
      status: COLORS.success('Completed'),
    });

    this.failedBar = this.multiBar.create(total, 0, {
      status: COLORS.error('Failed'),
    });

    // Overall progress bar
    this.overallBar = this.multiBar.create(total, 0, {
      format: chalk.white('Overall') + ' |{bar}| {percentage}% {value}/{total}',
    });
  }

  /**
   * Update queue state
   */
  update(state: QueueState): void {
    if (this.quietMode) return;

    this.pendingBar.update(state.pending);
    this.completedBar.update(state.completed);
    this.failedBar.update(state.failed);

    const doneCount = state.completed + state.failed;
    this.overallBar.update(doneCount, {
      percentage: Math.round((doneCount / state.total) * 100),
    });
  }

  /**
   * Update current task list
   */
  updateCurrentTasks(tasks: CurrentTask[]): void {
    if (this.quietMode) return;

    this.currentTasks = tasks;

    // Build display content
    const lines: string[] = [];

    lines.push('');
    lines.push(COLORS.info.bold('  Current Tasks'));
    lines.push('');

    // Show processing tasks first
    const processing = tasks.filter((t) => t.status === 'processing');
    const pending = tasks.filter((t) => t.status === 'pending').slice(0, 3);
    const recentCompleted = tasks.filter((t) => t.status === 'completed').slice(-2);
    const recentFailed = tasks.filter((t) => t.status === 'failed').slice(-1);

    // Processing tasks
    for (const task of processing) {
      const filename = truncate(task.path.split('/').pop() || task.path, 30);
      lines.push(`    ${ICONS.processing}  ${filename}     ${COLORS.processing('[分类中...]')}`);
    }

    // Pending tasks
    for (const task of pending) {
      const filename = truncate(task.path.split('/').pop() || task.path, 30);
      lines.push(`    ${ICONS.pending}  ${filename}     ${COLORS.muted('[等待中]')}`);
    }

    // Recent completed
    for (const task of recentCompleted) {
      const filename = truncate(task.path.split('/').pop() || task.path, 30);
      const output = task.filename ? `→ ${truncate(task.filename, 20)}` : '';
      lines.push(
        `    ${ICONS.success}  ${filename}     ${COLORS.success('[已完成]')} ${COLORS.muted(output)}`
      );
    }

    // Recent failed
    for (const task of recentFailed) {
      const filename = truncate(task.path.split('/').pop() || task.path, 30);
      const errorMsg = task.error ? truncate(task.error, 20) : 'Unknown error';
      lines.push(
        `    ${ICONS.error}  ${filename}     ${COLORS.error('[失败]')} ${COLORS.muted(errorMsg)}`
      );
    }

    if (this.verboseMode) {
      logUpdate(lines.join('\n'));
    } else {
      console.log(lines.join('\n'));
    }
  }

  /**
   * Add task to current list
   */
  addTask(task: CurrentTask): void {
    this.currentTasks.push(task);
    this.updateCurrentTasks(this.currentTasks);
  }

  /**
   * Update task status
   */
  updateTask(hash: string, status: CurrentTask['status'], data?: Partial<CurrentTask>): void {
    const index = this.currentTasks.findIndex((t) => t.hash === hash);
    if (index !== -1) {
      this.currentTasks[index] = {
        ...this.currentTasks[index],
        status,
        ...data,
      };
      this.updateCurrentTasks(this.currentTasks);
    }
  }

  /**
   * Display keyboard shortcuts hint
   */
  displayKeyboardHint(): void {
    const hint = boxen(
      COLORS.muted('  [P] 暂停') +
        COLORS.muted('  [S] 停止') +
        COLORS.muted('  [R] 重试失败') +
        COLORS.muted('  [V] 详细') +
        COLORS.muted('  [Q] 安静'),
      {
        borderStyle: 'round',
        padding: { left: 1, right: 1, top: 0, bottom: 0 },
        borderColor: 'gray',
      }
    );

    console.log('');
    console.log(hint);
  }

  /**
   * Set verbose mode
   */
  setVerbose(enabled: boolean): void {
    this.verboseMode = enabled;
  }

  /**
   * Set quiet mode
   */
  setQuiet(enabled: boolean): void {
    this.quietMode = enabled;
    if (enabled) {
      this.multiBar.stop();
    }
  }

  /**
   * Stop and cleanup
   */
  stop(): void {
    this.multiBar.stop();
  }
}

/**
 * Create standalone progress display
 */
export function displayProgressPanel(state: QueueState): void {
  const content = boxen(
    COLORS.info.bold('  PROCESSING') +
      '\n\n' +
      COLORS.warning(`  Pending    ${state.pending}`) +
      '\n' +
      COLORS.processing(`  Processing ${state.processing}`) +
      '\n' +
      COLORS.success(`  Completed  ${state.completed}`) +
      '\n' +
      COLORS.error(`  Failed     ${state.failed}`) +
      '\n\n' +
      '  ' +
      confidenceBar(state.completed / state.total, 40) +
      '  ' +
      formatConfidence(state.completed / state.total),
    {
      borderStyle: 'round',
      padding: 1,
      borderColor: 'blue',
    }
  );

  console.log(content);
}
