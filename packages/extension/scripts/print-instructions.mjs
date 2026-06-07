#!/usr/bin/env node

/**
 * 无浏览器模式开发启动脚本
 */

import chalk from 'chalk';
import path from 'path';

// 多语言提示
const messages = {
  zh: {
    title: '🔧 Chrome 扩展开发模式（无浏览器）',
    ready: '✓ 开发服务器正在启动...',
    stepTitle: '📋 手动加载扩展步骤：',
    steps: [
      '1. 打开 Chrome 浏览器',
      '2. 访问 chrome://extensions/',
      '3. 开启右上角"开发者模式"',
      '4. 点击"加载已解压的扩展程序"',
      '5. 选择下方目录'
    ],
    dirLabel: '📁 扩展目录：',
    tips: '💡 提示：打开任意网页按 F12，在面板列表找"Media Recorder"'
  },
  en: {
    title: '🔧 Chrome Extension Dev Mode (No Browser)',
    ready: '✓ Development server starting...',
    stepTitle: '📋 Steps to load extension:',
    steps: [
      '1. Open Chrome browser',
      '2. Go to chrome://extensions/',
      '3. Enable "Developer mode" (top right)',
      '4. Click "Load unpacked"',
      '5. Select the directory below'
    ],
    dirLabel: '📁 Extension directory:',
    tips: '💡 Tip: Open any page, press F12, find "Media Recorder" in panels'
  }
};

const locale = (process.env.LANG || '').includes('zh') ? 'zh' : 'en';
const msg = messages[locale];
const extDir = path.join(process.cwd(), '.wxt', 'chrome-mv3-dev');

// 输出提示
console.log('\n' + chalk.cyan('='.repeat(50)));
console.log(chalk.cyan.bold(msg.title));
console.log(chalk.cyan('='.repeat(50)) + '\n');

console.log(chalk.green(msg.ready) + '\n');

console.log(chalk.yellow.bold(msg.stepTitle));
msg.steps.forEach(s => console.log(chalk.white('  ' + s)));
console.log('\n');

console.log(chalk.white(msg.dirLabel));
console.log(chalk.blueBright('  ' + extDir) + '\n');

console.log(chalk.magenta(msg.tips) + '\n');
console.log(chalk.cyan('='.repeat(50)) + '\n');