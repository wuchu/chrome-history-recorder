#!/usr/bin/env node
/**
 * AI Classify - CLI Entry Point
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import axios from 'axios';
import { AIClassify } from './index.js';
import { Config, DEFAULT_CONFIG } from './types.js';
import {
  loadConfig,
  saveConfig,
  checkConfigExists,
  validateConfig,
  formatConfigErrors,
  getConfigValue,
  setConfigValue,
  listConfig,
} from './config.js';

const program = new Command();

program
  .name('ai-classify')
  .description('AI-powered file classification tool using Ollama')
  .version('0.1.0');

/**
 * Check for config file and prompt user if not found
 */
async function ensureConfig(projectDir: string): Promise<Config> {
  if (!(await checkConfigExists(projectDir))) {
    console.log('');
    console.log('✗ 未找到配置文件 .ai-classify.yaml');
    console.log('');
    console.log('请先运行初始化命令:');
    console.log('  ai-classify init');
    console.log('');
    process.exit(1);
  }
  return await loadConfig(projectDir);
}

/**
 * List directories in current directory (non-recursive)
 */
async function listDirectories(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => `./${e.name}`);
}

/**
 * Fetch available models from Ollama
 */
async function fetchOllamaModels(endpoint: string): Promise<string[]> {
  try {
    const response = await axios.get<{ models?: { name: string }[] }>(`${endpoint}/api/tags`, {
      timeout: 5000,
      headers: { Authorization: 'Bearer ollama' },
    });
    return response.data.models?.map((m) => m.name) || [];
  } catch {
    return [];
  }
}

// Init command - interactive configuration
program
  .command('init')
  .description('Initialize configuration file interactively')
  .action(async () => {
    const projectDir = process.cwd();
    const existingConfig = await checkConfigExists(projectDir);

    if (existingConfig) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: '配置文件已存在，是否覆盖？',
          default: false,
        },
      ]);
      if (!overwrite) {
        console.log('已取消');
        return;
      }
    }

    console.log('');
    console.log('开始初始化配置...');
    console.log('');

    // Step 1: Input directory
    const dirs = await listDirectories(projectDir);
    const inputChoices = [...dirs, new inquirer.Separator(), '手动输入'];

    const { inputSelection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'inputSelection',
        message: '选择输入目录:',
        choices: inputChoices,
        default: dirs.includes('./input') ? './input' : dirs[0] || '手动输入',
      },
    ]);

    let input: string;
    if (inputSelection === '手动输入') {
      const { manualInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualInput',
          message: '输入目录路径:',
          default: './input',
        },
      ]);
      input = manualInput;
    } else {
      input = inputSelection;
    }

    // Step 2: Output directory
    const { output } = await inquirer.prompt([
      {
        type: 'input',
        name: 'output',
        message: '输出目录:',
        default: './output',
      },
    ]);

    // Step 3: Ollama endpoint
    const { ollamaEndpoint } = await inquirer.prompt([
      {
        type: 'input',
        name: 'ollamaEndpoint',
        message: 'Ollama 服务地址:',
        default: 'http://localhost:11434',
      },
    ]);

    // Step 4: Vision model
    const models = await fetchOllamaModels(ollamaEndpoint);
    let visionModel: string;

    if (models.length > 0) {
      const { modelSelection } = await inquirer.prompt([
        {
          type: 'list',
          name: 'modelSelection',
          message: '选择视觉模型:',
          choices: [...models, new inquirer.Separator(), '手动输入', '稍后设置'],
        },
      ]);

      if (modelSelection === '手动输入') {
        const { manualModel } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualModel',
            message: '输入模型名称:',
          },
        ]);
        visionModel = manualModel;
      } else if (modelSelection === '稍后设置') {
        visionModel = '';
      } else {
        visionModel = modelSelection;
      }
    } else {
      const { modelChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'modelChoice',
          message: '无法连接 Ollama 服务，请选择:',
          choices: ['手动输入模型名称', '稍后在配置文件中设置'],
        },
      ]);

      if (modelChoice === '手动输入模型名称') {
        const { manualModel } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualModel',
            message: '输入模型名称:',
          },
        ]);
        visionModel = manualModel;
      } else {
        visionModel = '';
      }
    }

    // Step 5: Language
    const { language } = await inquirer.prompt([
      {
        type: 'list',
        name: 'language',
        message: '输出语言:',
        choices: [
          { name: '中文 (zh-CN)', value: 'zh-CN' },
          { name: '英文 (en)', value: 'en' },
        ],
        default: 'zh-CN',
      },
    ]);

    // Step 6: Filename style
    const { filenameStyle } = await inquirer.prompt([
      {
        type: 'list',
        name: 'filenameStyle',
        message: '文件命名风格:',
        choices: [
          { name: '自动判断 (auto)', value: 'auto' },
          { name: '活泼有趣 (fun)', value: 'fun' },
          { name: '优雅迷人 (sexy)', value: 'sexy' },
          { name: '艺术感 (artistic)', value: 'artistic' },
          { name: '诗意 (poetic)', value: 'poetic' },
          { name: '简洁 (minimal)', value: 'minimal' },
          { name: '专业 (professional)', value: 'professional' },
          { name: '故事叙述 (narrative)', value: 'narrative' },
        ],
        default: 'auto',
      },
    ]);

    // Step 7: Organize by
    const { organizeBy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'organizeBy',
        message: '文件组织方式:',
        choices: [
          { name: '按分类 (category)', value: 'category' },
          { name: '按日期 (date)', value: 'date' },
        ],
        default: 'category',
      },
    ]);

    // Build config
    const config: Config = {
      ...DEFAULT_CONFIG,
      input,
      output,
      ollamaEndpoint,
      visionModel,
      language,
      filenameStyle,
      organizeBy,
    };

    // Validate
    if (!visionModel) {
      console.log('');
      console.log('⚠ 警告: 未设置视觉模型，请稍后通过 config set 命令设置');
      console.log('  ai-classify config set visionModel <model-name>');
    }

    // Save
    await saveConfig(projectDir, config);
    console.log('');
    console.log('✓ 配置已保存到 .ai-classify.yaml');
    console.log('');
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

// Start command
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
      console.error(formatConfigErrors(errors));
      process.exit(1);
    }

    console.log('Configuration:');
    console.log(`  Input: ${config.input}`);
    console.log(`  Output: ${config.output}`);
    console.log(`  Ollama: ${config.ollamaEndpoint}`);
    console.log(`  Model: ${config.visionModel}`);
    console.log(`  Concurrency: ${config.concurrency}`);

    const aiClassify = new AIClassify(config, configDir);
    await aiClassify.initialize();
    await aiClassify.start();

    // Handle shutdown signals
    process.on('SIGINT', async () => {
      console.log('\nStopping...');
      await aiClassify.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await aiClassify.stop();
      process.exit(0);
    });
  });

// Status command
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
    console.log('Queue Status:');
    console.log(`  Pending: ${status.queue.pending}`);
    console.log(`  Processing: ${status.queue.processing}`);
    console.log(`  Failed: ${status.queue.failed}`);
    console.log(`  Total: ${status.queue.total}`);
    console.log('\nIndex:');
    console.log(`  Processed: ${status.indexSize} files`);
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
