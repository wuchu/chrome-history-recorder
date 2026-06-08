/**
 * AI Classify - Smart Init Wizard UI
 */

import boxen from 'boxen';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import axios from 'axios';
import { COLORS, ICONS } from './styles.js';
import { truncate } from './utils.js';
import { saveConfig } from '../config.js';
import type { Config, FilenameStyle } from '../types.js';

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

/**
 * Check if Ollama endpoint is available
 */
async function checkOllamaEndpoint(endpoint: string): Promise<boolean> {
  try {
    const response = await axios.get(`${endpoint}/api/tags`, {
      timeout: 5000,
      headers: { Authorization: 'Bearer ollama' },
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Display connection status
 */
function displayConnectionStatus(endpoint: string, connected: boolean): void {
  const status = connected
    ? COLORS.success(`${ICONS.success} Connected`)
    : COLORS.error(`${ICONS.error} Disconnected`);

  console.log(`  Ollama Server    ${endpoint}    ${status}`);
}

/**
 * Display models available
 */
function displayModelsAvailable(models: string[]): void {
  if (models.length > 0) {
    const modelsDisplay = models
      .map((m) => {
        if (m === 'llava' || m.includes('llava')) {
          return COLORS.highlight(m) + COLORS.muted(' ← 推荐');
        }
        return m;
      })
      .join(', ');
    console.log(`  Models available  ${truncate(modelsDisplay, 50)}`);
  } else {
    console.log(COLORS.warning(`  Models available  ${ICONS.warning} No models found`));
  }
}

/**
 * Run the smart init wizard
 */
export async function runInitWizard(projectDir: string): Promise<Config> {
  const defaultEndpoint = 'http://localhost:11434';

  console.log('');
  console.log(
    boxen(COLORS.info.bold('  AI Classify 配置向导'), {
      borderStyle: 'double',
      padding: 1,
      borderColor: 'blue',
    })
  );
  console.log('');

  // Check default endpoint
  console.log(COLORS.muted('  检测服务状态...'));
  const endpointConnected = await checkOllamaEndpoint(defaultEndpoint);
  displayConnectionStatus(defaultEndpoint, endpointConnected);
  console.log('');

  // Fetch models if connected
  let availableModels: string[] = [];
  if (endpointConnected) {
    availableModels = await fetchOllamaModels(defaultEndpoint);
    displayModelsAvailable(availableModels);
    console.log('');
  }

  // Get available directories
  const detectedDirs = await listDirectories(projectDir);
  console.log('');

  // Step 1: Input directory
  const inputChoices = [
    ...detectedDirs.map((d) => ({ name: d, value: d })),
    new inquirer.Separator(),
    { name: '手动输入路径', value: 'manual' },
    { name: '使用默认 ./input', value: './input' },
  ];

  const inputAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'input',
      message: '输入目录（监控媒体文件）:',
      choices: inputChoices,
      default: './downloads',
    },
  ]);

  let inputDir = inputAnswer.input;
  if (inputDir === 'manual') {
    const manualInput = await inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: '请输入路径:',
        default: './input',
      },
    ]);
    inputDir = manualInput.path;
  }

  // Step 2: Output directory
  const outputChoices = [
    { name: './organized', value: './organized' },
    new inquirer.Separator(),
    { name: '手动输入路径', value: 'manual' },
    { name: '使用默认 ./output', value: './output' },
  ];

  const outputAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'output',
      message: '输出目录（分类结果存放）:',
      choices: outputChoices,
      default: './organized',
    },
  ]);

  let outputDir = outputAnswer.output;
  if (outputDir === 'manual') {
    const manualOutput = await inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: '请输入路径:',
        default: './output',
      },
    ]);
    outputDir = manualOutput.path;
  }

  // Step 3: Ollama Endpoint
  const endpointChoices = [
    {
      name: defaultEndpoint + (endpointConnected ? COLORS.success(' ✓') : COLORS.error(' ✗')),
      value: defaultEndpoint,
    },
    new inquirer.Separator(),
    { name: '手动输入地址', value: 'manual' },
  ];

  const endpointAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'endpoint',
      message: 'Ollama 服务地址:',
      choices: endpointChoices,
      default: defaultEndpoint,
    },
  ]);

  let endpoint = endpointAnswer.endpoint;
  if (endpoint === 'manual') {
    const manualEndpoint = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: '请输入 Ollama 地址:',
        default: defaultEndpoint,
      },
    ]);
    endpoint = manualEndpoint.url;
  }

  // Step 4: Vision Model
  let modelChoices: Array<{ name: string; value: string }> = [];

  if (availableModels.length > 0) {
    modelChoices = availableModels.map((m) => ({
      name: m + (m === 'llava' || m.includes('llava') ? COLORS.muted(' ← 推荐') : ''),
      value: m,
    }));
  } else {
    modelChoices = [
      { name: 'llava (推荐)', value: 'llava' },
      { name: 'moondream', value: 'moondream' },
      { name: 'bakllava', value: 'bakllava' },
    ];
  }

  modelChoices.push({ name: '手动输入模型名', value: 'manual' });

  const modelAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Vision 模型选择:',
      choices: modelChoices,
      default: 'llava',
    },
  ]);

  let model = modelAnswer.model;
  if (model === 'manual') {
    const manualModel = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '请输入模型名:',
        default: 'llava',
      },
    ]);
    model = manualModel.name;
  }

  // Show install hint if no models
  if (availableModels.length === 0) {
    console.log('');
    console.log(COLORS.warning(`  ${ICONS.warning} 未检测到已安装的模型`));
    console.log(COLORS.muted(`  请运行: ollama pull ${model}`));
    console.log('');
  }

  // Step 5: Language
  const languageAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: '输出语言:',
      choices: [
        { name: '中文', value: 'zh-CN' },
        { name: 'English', value: 'en' },
      ],
      default: 'zh-CN',
    },
  ]);

  // Step 6: Filename Style
  const styleAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'style',
      message: '文件名风格:',
      choices: [
        { name: 'auto - 根据内容自动选择', value: 'auto' },
        { name: 'fun - 活泼有趣', value: 'fun' },
        { name: 'poetic - 诗意意境', value: 'poetic' },
        { name: 'minimal - 简洁', value: 'minimal' },
        { name: 'professional - 专业客观', value: 'professional' },
        { name: 'narrative - 故事叙述', value: 'narrative' },
      ],
      default: 'auto',
    },
  ]);

  // Step 7: Organize mode
  const organizeAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'organizeBy',
      message: '组织方式:',
      choices: [
        { name: '按分类目录', value: 'category' },
        { name: '按日期目录', value: 'date' },
      ],
      default: 'category',
    },
  ]);

  // Build config
  const config: Config = {
    input: inputDir,
    output: outputDir,
    ollamaEndpoint: endpoint,
    visionModel: model,
    language: languageAnswer.language,
    filenameStyle: styleAnswer.style as FilenameStyle,
    organizeBy: organizeAnswer.organizeBy,
    patterns: ['**/*.{jpg,jpeg,png,gif,webp,bmp,mp4}'],
    ignorePatterns: ['**/node_modules/**', '**/.git/**'],
    maxFileSize: 50 * 1024 * 1024,
    concurrency: 3,
  };

  // Save config
  await saveConfig(projectDir, config);

  // Display completion
  console.log('');
  console.log(
    boxen(
      COLORS.success(`${ICONS.success} 配置已保存到 .ai-classify.yaml`) +
        '\n\n' +
        COLORS.muted('下一步:') +
        '\n' +
        COLORS.info('  ai-classify start') +
        COLORS.muted('  开始处理') +
        '\n' +
        COLORS.info('  ai-classify status') +
        COLORS.muted('  查看状态') +
        '\n' +
        COLORS.info('  ai-classify config') +
        COLORS.muted('  修改配置'),
      {
        borderStyle: 'round',
        padding: 1,
        borderColor: 'green',
      }
    )
  );
  console.log('');

  return config;
}
