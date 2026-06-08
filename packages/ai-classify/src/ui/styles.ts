/**
 * AI Classify - UI Styles and Color Constants
 */

import chalk from 'chalk';

// Status colors
export const COLORS = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  processing: chalk.cyan,
  muted: chalk.gray,
  highlight: chalk.white.bold,
};

// Status icons
export const ICONS = {
  success: '✓',
  error: '✗',
  processing: '◉',
  pending: '○',
  warning: '⚠',
  bullet: '●',
  arrow: '──▶',
};

// Box styles for boxen
export const BOX_STYLES = {
  default: {
    borderStyle: 'round',
    padding: 1,
    borderColor: 'blue',
  },
  success: {
    borderStyle: 'round',
    padding: 1,
    borderColor: 'green',
  },
  error: {
    borderStyle: 'round',
    padding: 1,
    borderColor: 'red',
  },
};

// Progress bar characters
export const PROGRESS_CHARS = {
  complete: '█',
  incomplete: '░',
  width: 40,
};

// Gradient colors for logo
export const GRADIENT_COLORS = {
  rainbow: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'],
  pastel: ['#ffd1dc', '#aec6cf', '#b39eb5', '#cfcfc4', '#fdfd96', '#cb99c9'],
};

// Terminal compatibility detection
export function detectTerminalCapabilities() {
  const termProgram = process.env.TERM_PROGRAM || '';

  return {
    supportsGradient: termProgram === 'iTerm.app' || termProgram === 'vscode',
    supportsImage: termProgram === 'iTerm.app',
    supportsColor: process.stdout.hasColors && process.stdout.hasColors(),
    supportsUnicode: true, // Most modern terminals support Unicode
  };
}
