# CLI Experience Design

## Overview

使用 Node.js 终端 UI 库构建炫酷的 CLI 界面。

## Technology Stack

| 功能 | 库 | 说明 |
|------|-----|------|
| ASCII Art Logo | `figlet` | 生成大字标题 |
| 边框面板 | `boxen` | 美观的边框容器 |
| 颜色 | `chalk`, `gradient-string` | 彩色输出和渐变 |
| 进度条 | `cli-progress` | 多进度条支持 |
| Spinner | `ora` | 加载动画 |
| 动画 | `chalk-animation` | Logo 动画效果 |
| 键盘 | `keypress` | 运行时按键监听 |
| 终端图片 | `terminal-image` | 可选的图片预览 |
| 实时更新 | `log-update` | 更新已显示内容 |

## UI Layout

```
╔══════════════════════════════════════════════════════════════════════════╗
║     █████╗ ██╗...          (ASCII Art Logo - figlet + gradient)          ║
║                      AI-Powered File Classifier                          ║
║                           v0.2.0 · Ollama                                ║
╚══════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────┐
│  CONFIG (boxen 边框面板)                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│   Input      ──▶  ./downloads                                            │
│   Output     ──▶  ./organized                                            │
│   ...                                                                     │
│   ● Ollama Server     ✓ Connected                                        │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  PROCESSING                                                               │
├──────────────────────────────────────────────────────────────────────────┤
│   Queue Status (cli-progress 多进度条)                                    │
│   Pending    ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  23                   │
│   Processing  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  2                    │
│   Completed   ████████████████████████████████████  156                  │
│                                                                            │
│   Overall Progress                                                         │
│   ████████████████████████████████████░░░░░░░░░░░░  65%  102/156          │
│                                                                            │
│   Current Tasks (ora spinner + 列表)                                       │
│   ◉  cat.jpg         [分类中...]                                          │
│   ○  dog.jpg         [等待中]                                              │
│   ✓  food.jpg        [已完成]    →  food/美味午餐.jpg                     │
│                                                                            │
│   [P] 暂停  [S] 停止  [R] 重试失败  [V] 详细  [Q] 安静                     │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  RESULT (boxen 卡片)                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│   Source: ./downloads/...                                                 │
│   Category:  cat                                                          │
│   Filename:  慵懒猫咪在窗台晒太阳.jpg                                      │
│   Confidence: ████████████████████████████████░░  92%                    │
│   Output: ./organized/cat/慵懒猫咪在窗台晒太阳.jpg                         │
│   Tags: #猫 #黑白 #慵懒 #窗台 #阳光                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

## Implementation Approach

### Phase 1: 启动画面

```typescript
// ui/startup.ts

import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';

export function displayStartup(config: Config, status: StartupStatus) {
  // 1. Logo
  const logo = figlet.textSync('AI Classify', { font: 'ANSI Shadow' });
  console.log(gradient.rainbow(logo));
  
  // 2. 版本信息
  console.log(chalk.gray('  AI-Powered File Classifier'));
  console.log(chalk.gray(`  v${VERSION} · Ollama`));
  
  // 3. 配置面板
  const configPanel = boxen(
    formatConfigPanel(config, status),
    { title: 'CONFIG', borderStyle: 'round', padding: 1 }
  );
  console.log(configPanel);
}
```

### Phase 2: 进度可视化

```typescript
// ui/progress.ts

import cliProgress from 'cli-progress';
import logUpdate from 'log-update';

export class ProgressUI {
  private multiBar: cliProgress.MultiBar;
  private queueBars: Map<string, cliProgress.SingleBar>;
  private overallBar: cliProgress.SingleBar;
  
  constructor() {
    this.multiBar = new cliProgress.MultiBar({
      format: '{status} |{bar}| {value}/{total}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
    });
    
    // 创建各状态进度条
    this.queueBars.set('pending', this.multiBar.create(total, 0, { status: 'Pending' }));
    this.queueBars.set('processing', this.multiBar.create(concurrency, 0, { status: 'Processing' }));
    this.queueBars.set('completed', this.multiBar.create(total, 0, { status: 'Completed' }));
    
    // 总体进度条
    this.overallBar = this.multiBar.create(total, 0, {
      format: 'Overall |{bar}| {percentage}% {value}/{total}',
    });
  }
  
  update(state: QueueState) {
    this.queueBars.get('pending')?.update(state.pending.length);
    this.queueBars.get('completed')?.update(state.completed.length);
    this.overallBar.update(state.completed.length + state.failed.length);
  }
  
  updateCurrentTasks(tasks: Task[]) {
    const content = tasks.map(t => this.formatTaskLine(t)).join('\n');
    logUpdate(content);
  }
}
```

### Phase 3: 键盘交互

```typescript
// ui/keyboard.ts

import keypress from 'keypress';

export class KeyboardHandler {
  private paused = false;
  
  constructor(aiClassify: AIClassify) {
    keypress(process.stdin);
    process.stdin.on('keypress', (ch, key) => {
      if (!key) return;
      
      switch (key.name) {
        case 'p':
          this.paused ? aiClassify.resume() : aiClassify.pause();
          this.paused = !this.paused;
          break;
        case 's':
          aiClassify.stop();
          break;
        case 'r':
          aiClassify.retryFailed();
          break;
        case 'v':
          // 切换详细模式
          break;
        case 'q':
          // 切换安静模式
          break;
      }
    });
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }
}
```

### Phase 4: 智能配置向导

```typescript
// ui/init-wizard.ts

export async function runInitWizard(projectDir: string) {
  // 智能检测
  const detectedDirs = await listDirectories(projectDir);
  const detectedModels = await fetchOllamaModels(endpoint);
  const endpointStatus = await checkEndpoint(endpoint);
  
  // 显示状态图标
  console.log(chalk.blue('●') + ' Ollama Server    ' + endpointStatus);
  console.log(chalk.green('✓') + ' Models available ' + detectedModels.join(', '));
  
  // 提供选择
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'input',
      message: '输入目录（监控媒体文件）',
      choices: [...detectedDirs, new inquirer.Separator(), '手动输入', '使用默认'],
    },
    {
      type: 'list',
      name: 'model',
      message: 'Vision 模型选择',
      choices: detectedModels.map(m => ({
        name: m + (m === 'llava' ? chalk.gray(' ← 推荐') : ''),
        value: m,
      })),
    },
    // ...
  ]);
  
  // 显示下一步提示
  console.log(boxen(
    '✓ 配置已保存到 .ai-classify.yaml\n\n下一步:\n  ai-classify start  开始处理\n  ai-classify status  查看状态',
    { borderStyle: 'round', padding: 1 }
  ));
}
```

## File Structure

```
packages/ai-classify/src/
├── cli.ts                  # 主入口（改造）
├── ui/
│   ├── index.ts            # UI 模块导出
│   ├── startup.ts          # 启动画面
│   ├── progress.ts         # 进度可视化
│   ├── result.ts           # 结果卡片
│   ├── keyboard.ts         # 键盘交互
│   ├── init-wizard.ts      # 智能配置向导
│   └── styles.ts           # 颜色/样式常量
│   └── utils.ts            # UI 辅助函数
```

## Dependencies to Add

```json
{
  "dependencies": {
    "figlet": "^1.7.0",
    "boxen": "^7.1.1",
    "chalk": "^5.3.0",
    "gradient-string": "^2.0.2",
    "cli-progress": "^3.12.0",
    "ora": "^8.0.1",
    "chalk-animation": "^2.0.3",
    "keypress": "^0.2.1",
    "terminal-image": "^2.0.0",
    "log-update": "^6.0.0"
  }
}
```

## Terminal Compatibility

| 特性 | iTerm2 | VSCode Terminal | Terminal.app | Windows Terminal |
|------|--------|-----------------|--------------|------------------|
| ANSI 颜色 | ✓ | ✓ | ✓ | ✓ |
| Unicode 边框 | ✓ | ✓ | ✓ | ✓ |
| 渐变色 | ✓ | ✓ | 部分 | 部分 |
| 终端图片 | ✓ | 部分 | ✗ | ✗ |

检测并降级：
```typescript
const supportsImage = terminalImage.isSupported();
const supportsGradient = process.env.TERM_PROGRAM === 'iTerm.app' || process.env.TERM_PROGRAM === 'vscode';
```