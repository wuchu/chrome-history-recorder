#!/usr/bin/env node
/**
 * AI Classify - CLI Entry Point
 */

import { Command } from 'commander';
import boxen from 'boxen';
import { AIClassify } from './index.js';
import { Config } from './types.js';
import {
  loadConfig,
  checkConfigExists,
  validateConfig,
  formatConfigErrors,
  getConfigValue,
  setConfigValue,
  listConfig,
} from './config.js';
import {
  displayStartup,
  displayConnectingStatus,
  displayStartupError,
  runInitWizard,
  ProgressUI,
  KeyboardHandler,
  COLORS,
  ICONS,
} from './ui/index.js';
import { checkOllamaHealth } from './classifier.js';

const program = new Command();

program
  .name('ai-classify')
  .description('AI-powered file classification tool using Ollama')
  .version('0.2.0');

/**
 * Check for config file and prompt user if not found
 */
async function ensureConfig(projectDir: string): Promise<Config> {
  if (!(await checkConfigExists(projectDir))) {
    console.log('');
    console.log(
      boxen(
        COLORS.error(`${ICONS.error} 未找到配置文件 .ai-classify.yaml`) +
          '\n\n' +
          COLORS.muted('请先运行初始化命令:') +
          '\n' +
          COLORS.info('  ai-classify init'),
        {
          borderStyle: 'round',
          padding: 1,
          borderColor: 'red',
        }
      )
    );
    console.log('');
    process.exit(1);
  }
  return await loadConfig(projectDir);
}

// Init command - interactive configuration with smart wizard
program
  .command('init')
  .description('Initialize configuration file interactively')
  .action(async () => {
    const projectDir = process.cwd();
    const existingConfig = await checkConfigExists(projectDir);

    if (existingConfig) {
      // Show warning and ask for confirmation
      console.log('');
      console.log(
        boxen(
          COLORS.warning(`${ICONS.warning} 配置文件已存在`) +
            '\n\n' +
            COLORS.muted('将覆盖现有的 .ai-classify.yaml'),
          {
            borderStyle: 'round',
            padding: 1,
            borderColor: 'yellow',
          }
        )
      );
      console.log('');
    }

    // Run the smart wizard
    await runInitWizard(projectDir);
  });

// Config command with subcommands
program
  .command('config')
  .description('Manage configuration')
  .argument('<action>', 'list, get, or set')
  .argument('[key]', 'config key (for get/set)')
  .argument('[value]', 'config value (for set)')
  .action(async (action, key, value) => {
    const projectDir = process.cwd();

    if (!(await checkConfigExists(projectDir))) {
      console.log('✗ 未找到配置文件 .ai-classify.yaml');
      console.log('请先运行: ai-classify init');
      process.exit(1);
    }

    switch (action) {
      case 'list': {
        const config = await listConfig(projectDir);
        console.log('');
        console.log('当前配置:');
        console.log('');
        for (const [k, v] of Object.entries(config)) {
          if (v !== undefined) {
            console.log(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
          }
        }
        console.log('');
        break;
      }

      case 'get': {
        if (!key) {
          console.log('✗ 请指定配置项名称');
          console.log('用法: ai-classify config get <key>');
          process.exit(1);
        }
        const val = await getConfigValue(projectDir, key);
        console.log(`${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
        break;
      }

      case 'set': {
        if (!key || !value) {
          console.log('✗ 请指定配置项名称和值');
          console.log('用法: ai-classify config set <key> <value>');
          process.exit(1);
        }
        // Parse value (handle numbers, booleans, arrays)
        let parsedValue: string | number | boolean | object = value;
        if (value.startsWith('[') || value.startsWith('{')) {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // Keep original value if parse fails
          }
        } else if (/^\d+$/.test(value)) {
          parsedValue = parseInt(value);
        } else if (value === 'true' || value === 'false') {
          parsedValue = value === 'true';
        }
        await setConfigValue(projectDir, key, parsedValue);
        console.log(`✓ 已设置 ${key} = ${parsedValue}`);
        break;
      }

      default:
        console.log('✗ 未知操作:', action);
        console.log('可用操作: list, get, set');
        process.exit(1);
    }
  });

// Start command - with enhanced UI
program
  .command('start')
  .description('Start watching and classifying files')
  .action(async () => {
    const projectDir = process.cwd();
    const config = await ensureConfig(projectDir);
    const configDir = projectDir;

    // Validate configuration
    const errors = validateConfig(config);
    if (errors.length > 0) {
      displayStartupError(formatConfigErrors(errors));
      process.exit(1);
    }

    // Check Ollama connection
    displayConnectingStatus(config.ollamaEndpoint);
    const ollamaConnected = await checkOllamaHealth(config);

    // Count input files
    let inputFiles = 0;
    try {
      const files = await import('./watcher.js');
      const scanned = await files.scanExistingFiles(config);
      inputFiles = scanned.length;
    } catch {
      inputFiles = 0;
    }

    // Display startup screen
    displayStartup(config, {
      ollamaConnected,
      ollamaEndpoint: config.ollamaEndpoint,
      inputFiles,
      outputReady: true,
    });

    if (!ollamaConnected) {
      console.log(COLORS.warning(`${ICONS.warning} Ollama 服务未连接，分类功能可能受限`));
      console.log('');
    }

    // Initialize AI Classify
    const aiClassify = new AIClassify(config, configDir);
    await aiClassify.initialize();

    // Create progress UI
    const status = aiClassify.getStatus();
    const progressUI = new ProgressUI(status.queue.total, config.concurrency);

    // Create keyboard handler
    const keyboardHandler = new KeyboardHandler({
      onPause: () => aiClassify.pause(),
      onResume: () => aiClassify.resume(),
      onStop: async () => {
        progressUI.stop();
        keyboardHandler.stop();
        await aiClassify.stop();
        process.exit(0);
      },
      onRetry: () => aiClassify.retryFailed(),
      onVerboseChange: (enabled) => progressUI.setVerbose(enabled),
      onQuietChange: (enabled) => progressUI.setQuiet(enabled),
    });

    // Show keyboard hints
    keyboardHandler.displayKeyboardHint();
    keyboardHandler.start();

    // Start processing
    await aiClassify.start();

    // Handle shutdown signals
    process.on('SIGINT', async () => {
      progressUI.stop();
      keyboardHandler.stop();
      console.log('');
      console.log(COLORS.muted('Stopping...'));
      await aiClassify.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      progressUI.stop();
      keyboardHandler.stop();
      await aiClassify.stop();
      process.exit(0);
    });
  });

// Status command - with enhanced panel display
program
  .command('status')
  .description('Show queue and index status')
  .action(async () => {
    const projectDir = process.cwd();
    const config = await ensureConfig(projectDir);
    const configDir = projectDir;

    const aiClassify = new AIClassify(config, configDir);
    await aiClassify.initialize();

    const status = aiClassify.getStatus();

    // Display beautiful status panel
    const content = boxen(
      COLORS.info.bold('  Queue Status') +
        '\n\n' +
        COLORS.warning(`  Pending     ${ICONS.pending} ${status.queue.pending}`) +
        '\n' +
        COLORS.processing(`  Processing   ${ICONS.processing} ${status.queue.processing}`) +
        '\n' +
        COLORS.success(`  Completed    ${ICONS.success} ${status.queue.completed || 0}`) +
        '\n' +
        COLORS.error(`  Failed       ${ICONS.error} ${status.queue.failed}`) +
        '\n' +
        COLORS.muted(`  Total        ${status.queue.total}`) +
        '\n\n' +
        COLORS.info.bold('  Index') +
        '\n\n' +
        COLORS.muted(`  Processed    ${status.indexSize} files`),
      {
        borderStyle: 'round',
        padding: 1,
        borderColor: 'blue',
      }
    );

    console.log('');
    console.log(content);
    console.log('');
  });

// Clear command
program
  .command('clear')
  .description('Clear queue and index')
  .action(async () => {
    const projectDir = process.cwd();
    const config = await ensureConfig(projectDir);
    const configDir = projectDir;

    const aiClassify = new AIClassify(config, configDir);
    await aiClassify.initialize();
    await aiClassify.clear();

    console.log('Queue and index cleared');
  });

// Reprocess command
program
  .command('reprocess')
  .description('Scan input directory and reprocess all files')
  .action(async () => {
    const projectDir = process.cwd();
    const config = await ensureConfig(projectDir);
    const configDir = projectDir;

    const aiClassify = new AIClassify(config, configDir);
    await aiClassify.initialize();
    await aiClassify.clear();
    await aiClassify.scanAndEnqueue();

    console.log('Starting reprocess...');
    await aiClassify.start();
  });

program.parse();
