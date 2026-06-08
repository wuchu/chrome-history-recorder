/**
 * AI Classify - Startup Screen UI
 */

import figlet from 'figlet';
import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { COLORS, ICONS, detectTerminalCapabilities } from './styles.js';
import type { Config } from '../types.js';

const VERSION = '0.2.0';

interface StartupStatus {
  ollamaConnected: boolean;
  ollamaEndpoint: string;
  inputFiles: number;
  outputReady: boolean;
}

/**
 * Display ASCII Art Logo with gradient
 */
export function displayLogo(): void {
  const capabilities = detectTerminalCapabilities();

  let logo: string;
  try {
    // Use simpler font if terminal doesn't support complex fonts
    const font = capabilities.supportsUnicode ? 'ANSI Shadow' : 'Standard';
    logo = figlet.textSync('AI Classify', {
      font,
      horizontalLayout: 'default',
      verticalLayout: 'default',
    });
  } catch {
    // Fallback to simple text if figlet fails
    logo = '  AI Classify';
  }

  if (capabilities.supportsGradient) {
    console.log(gradient.pastel.multiline(logo));
  } else if (capabilities.supportsColor) {
    console.log(chalk.cyan(logo));
  } else {
    console.log(logo);
  }

  // Version info
  console.log(COLORS.muted('  AI-Powered File Classifier'));
  console.log(COLORS.muted(`  v${VERSION} · Ollama`));
  console.log('');
}

/**
 * Format config panel content
 */
export function formatConfigPanel(config: Config, status: StartupStatus): string {
  const lines: string[] = [];

  lines.push(COLORS.muted('  Configuration'));
  lines.push('');

  // Config items
  lines.push(`  Input      ${ICONS.arrow}  ${config.input}`);
  lines.push(`  Output     ${ICONS.arrow}  ${config.output}`);
  lines.push(`  Model      ${ICONS.arrow}  ${config.visionModel}`);
  lines.push(`  Language   ${ICONS.arrow}  ${config.language ?? 'zh-CN'}`);
  lines.push(`  Style      ${ICONS.arrow}  ${config.filenameStyle ?? 'auto'}`);
  lines.push(`  Organize   ${ICONS.arrow}  ${config.organizeBy}`);
  lines.push('');

  // Service status
  lines.push(COLORS.muted('  Service Status'));
  lines.push('');

  const ollamaStatus = status.ollamaConnected
    ? COLORS.success(`${ICONS.success} Connected`)
    : COLORS.error(`${ICONS.error} Disconnected`);

  lines.push(`  Ollama Server     ${status.ollamaEndpoint}     ${ollamaStatus}`);

  const inputStatus =
    status.inputFiles > 0
      ? COLORS.success(`${ICONS.success} ${status.inputFiles} files`)
      : COLORS.warning(`${ICONS.pending} empty`);

  lines.push(`  Input Directory   ${config.input}             ${inputStatus}`);

  const outputStatus = status.outputReady
    ? COLORS.success(`${ICONS.success} Ready`)
    : COLORS.warning(`${ICONS.pending} Not ready`);

  lines.push(`  Output Directory  ${config.output}            ${outputStatus}`);

  return lines.join('\n');
}

/**
 * Display startup screen
 */
export function displayStartup(config: Config, status: StartupStatus): void {
  console.clear();

  // Logo
  displayLogo();

  // Config panel
  const configPanel = boxen(formatConfigPanel(config, status), {
    title: chalk.blue.bold(' CONFIG'),
    borderStyle: 'round',
    padding: 1,
    borderColor: 'blue',
  });

  console.log(configPanel);
  console.log('');
}

/**
 * Display service connection status animation
 */
export function displayConnectingStatus(endpoint: string): void {
  const message = boxen(
    COLORS.processing(`  ${ICONS.processing} Connecting to Ollama...`) +
      '\n\n' +
      COLORS.muted(`  Endpoint: ${endpoint}`),
    {
      borderStyle: 'round',
      padding: 1,
      borderColor: 'yellow',
    }
  );

  console.log(message);
}

/**
 * Display startup error
 */
export function displayStartupError(error: string): void {
  const message = boxen(
    COLORS.error(`  ${ICONS.error} Failed to start`) +
      '\n\n' +
      COLORS.muted(`  Error: ${error}`) +
      '\n\n' +
      COLORS.muted('  Please check your configuration and try again.'),
    {
      title: chalk.red.bold(' ERROR'),
      borderStyle: 'round',
      padding: 1,
      borderColor: 'red',
    }
  );

  console.log(message);
}
