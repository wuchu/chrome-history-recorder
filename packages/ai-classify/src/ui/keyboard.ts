/**
 * AI Classify - Keyboard Interaction Handler
 */

import boxen from 'boxen';
import { COLORS, ICONS } from './styles.js';

interface KeyboardHandlerOptions {
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetry: () => void;
  onVerboseChange: (enabled: boolean) => void;
  onQuietChange: (enabled: boolean) => void;
}

/**
 * Keyboard Handler for runtime control
 */
export class KeyboardHandler {
  private paused: boolean = false;
  private verboseMode: boolean = false;
  private quietMode: boolean = false;
  private handlers: KeyboardHandlerOptions;
  private started: boolean = false;

  constructor(handlers: KeyboardHandlerOptions) {
    this.handlers = handlers;
  }

  /**
   * Start listening for keyboard input
   */
  start(): void {
    if (this.started) return;

    this.started = true;

    // Enable raw mode to capture individual keystrokes
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', (key: string) => {
        this.handleKey(key);
      });
    }
  }

  /**
   * Stop listening for keyboard input
   */
  stop(): void {
    if (!this.started) return;

    this.started = false;

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }

  /**
   * Handle key press
   */
  private handleKey(key: string): void {
    const keyLower = key.toLowerCase();

    // Handle Ctrl+C
    if (key === '' || keyLower === 's') {
      this.displayStatus('Stopping...');
      this.handlers.onStop();
      this.stop();
      return;
    }

    // Handle actions
    switch (keyLower) {
      case 'p':
        if (this.paused) {
          this.displayStatus('Resuming...');
          this.handlers.onResume();
          this.paused = false;
        } else {
          this.displayStatus('Paused');
          this.handlers.onPause();
          this.paused = true;
        }
        break;

      case 'r':
        this.displayStatus('Retrying failed tasks...');
        this.handlers.onRetry();
        break;

      case 'v':
        this.verboseMode = !this.verboseMode;
        {
          const verboseStatus = this.verboseMode ? 'Verbose mode ON' : 'Verbose mode OFF';
          this.displayStatus(verboseStatus);
        }
        this.handlers.onVerboseChange(this.verboseMode);
        break;

      case 'q':
        this.quietMode = !this.quietMode;
        {
          const quietStatus = this.quietMode ? 'Quiet mode ON' : 'Quiet mode OFF';
          this.displayStatus(quietStatus);
        }
        this.handlers.onQuietChange(this.quietMode);
        break;
    }
  }

  /**
   * Display status message
   */
  private displayStatus(message: string): void {
    console.log('');
    console.log(
      boxen(COLORS.info(`${ICONS.bullet} ${message}`), {
        borderStyle: 'round',
        padding: { left: 1, right: 1, top: 0, bottom: 0 },
        borderColor: 'blue',
      })
    );
    console.log('');
  }

  /**
   * Display keyboard shortcuts hint
   */
  displayKeyboardHint(): void {
    const hint = boxen(
      COLORS.muted('  Keyboard Shortcuts') +
        '\n\n' +
        COLORS.muted('  [P] Pause/Resume') +
        COLORS.muted('  [S] Stop') +
        COLORS.muted('  [R] Retry Failed') +
        '\n' +
        COLORS.muted('  [V] Verbose Mode') +
        COLORS.muted('  [Q] Quiet Mode') +
        COLORS.muted('  [Ctrl+C] Exit'),
      {
        borderStyle: 'round',
        padding: 1,
        borderColor: 'gray',
      }
    );

    console.log('');
    console.log(hint);
  }

  /**
   * Get current state
   */
  getState(): { paused: boolean; verbose: boolean; quiet: boolean } {
    return {
      paused: this.paused,
      verbose: this.verboseMode,
      quiet: this.quietMode,
    };
  }
}

/**
 * Display pause state message
 */
export function displayPauseState(): void {
  const message = boxen(
    COLORS.warning(`${ICONS.warning} PAUSED`) + '\n\n' + COLORS.muted('  Press [P] to resume'),
    {
      borderStyle: 'round',
      padding: 1,
      borderColor: 'yellow',
    }
  );

  console.log(message);
}

/**
 * Display stop confirmation message
 */
export function displayStopMessage(): void {
  const message = boxen(
    COLORS.success(`${ICONS.success} Stopped`) +
      '\n\n' +
      COLORS.muted('  Processing stopped. State saved.'),
    {
      borderStyle: 'round',
      padding: 1,
      borderColor: 'green',
    }
  );

  console.log(message);
}
