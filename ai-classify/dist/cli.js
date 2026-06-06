#!/usr/bin/env node
/**
 * AI Classify - CLI Entry Point
 */
import { Command } from 'commander';
import { AIClassify } from './index.js';
import { DEFAULT_CONFIG } from './types.js';
import { loadConfig, saveConfig, mergeWithCliArgs } from './config.js';
const program = new Command();
program
    .name('ai-classify')
    .description('AI-powered file classification tool using Ollama')
    .version('0.1.0');
// Start command
program
    .command('start')
    .description('Start watching and classifying files')
    .option('-i, --input <dir>', 'Input directory to watch')
    .option('-o, --output <dir>', 'Output directory for classified files')
    .option('--ollama <url>', 'Ollama API endpoint')
    .option('--vision-model <model>', 'Vision model for images')
    .option('--text-model <model>', 'Text model for documents')
    .action(async (options) => {
    const projectDir = process.cwd();
    const baseConfig = await loadConfig(projectDir);
    const config = mergeWithCliArgs(baseConfig, {
        input: options.input,
        output: options.output,
        ollamaEndpoint: options.ollama,
        visionModel: options.visionModel,
        textModel: options.textModel
    });
    console.log('Configuration:');
    console.log(`  Input: ${config.input}`);
    console.log(`  Output: ${config.output}`);
    console.log(`  Ollama: ${config.ollamaEndpoint}`);
    const aiClassify = new AIClassify(config);
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
    .option('-o, --output <dir>', 'Output directory')
    .action(async (options) => {
    const projectDir = process.cwd();
    const baseConfig = await loadConfig(projectDir);
    const config = mergeWithCliArgs(baseConfig, {
        output: options.output
    });
    const aiClassify = new AIClassify(config);
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
    .option('-o, --output <dir>', 'Output directory')
    .action(async (options) => {
    const projectDir = process.cwd();
    const baseConfig = await loadConfig(projectDir);
    const config = mergeWithCliArgs(baseConfig, {
        output: options.output
    });
    const aiClassify = new AIClassify(config);
    await aiClassify.initialize();
    await aiClassify.clear();
    console.log('Queue and index cleared');
});
// Reprocess command
program
    .command('reprocess')
    .description('Scan input directory and reprocess all files')
    .option('-i, --input <dir>', 'Input directory')
    .option('-o, --output <dir>', 'Output directory')
    .action(async (options) => {
    const projectDir = process.cwd();
    const baseConfig = await loadConfig(projectDir);
    const config = mergeWithCliArgs(baseConfig, {
        input: options.input,
        output: options.output
    });
    const aiClassify = new AIClassify(config);
    await aiClassify.initialize();
    await aiClassify.clear();
    await aiClassify.scanAndEnqueue();
    console.log('Starting reprocess...');
    await aiClassify.start();
});
// Config command
program
    .command('config')
    .description('Create or update configuration file')
    .option('-i, --input <dir>', 'Input directory')
    .option('-o, --output <dir>', 'Output directory')
    .option('--ollama <url>', 'Ollama API endpoint')
    .action(async (options) => {
    const projectDir = process.cwd();
    const config = {
        ...DEFAULT_CONFIG,
        input: options.input || DEFAULT_CONFIG.input,
        output: options.output || DEFAULT_CONFIG.output,
        ollamaEndpoint: options.ollama || DEFAULT_CONFIG.ollamaEndpoint
    };
    await saveConfig(projectDir, config);
    console.log('Configuration saved to .ai-classify.json');
});
program.parse();
//# sourceMappingURL=cli.js.map