#!/usr/bin/env node
/**
 * AI Classify - CLI Entry Point
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { AIClassify } from './index.js';
import { Config, DEFAULT_CONFIG } from './types.js';
import { loadConfig, saveConfig, mergeWithCliArgs, validateConfig, formatConfigErrors } from './config.js';

const program = new Command();

program
  .name('ai-classify')
  .description('AI-powered file classification tool using Ollama')
  .version('0.1.0')
  // Global options
  .option('-c, --config <file>', 'Config file path')
  .option('-i, --input <dir>', 'Input directory')
  .option('-o, --output <dir>', 'Output directory')
  // Ollama-related options (unified --ollama-xxx prefix)
  .option('--ollama-endpoint <url>', 'Ollama API endpoint')
  .option('--ollama-vision-model <model>', 'Ollama vision model for images')
  .option('--ollama-text-model <model>', 'Ollama text model for documents')
  .option('--ollama-prompt <text>', 'Custom classification prompt')
  .option('--ollama-max-concurrency <number>', 'Max concurrent requests to Ollama', parseInt);

// Start command
program
  .command('start')
  .description('Start watching and classifying files')
  .action(async (options) => {
    const globalOptions = program.opts();
    const projectDir = process.cwd();
    const baseConfig = await loadConfig(projectDir, globalOptions.config);
    const config = mergeWithCliArgs(baseConfig, {
      input: globalOptions.input,
      output: globalOptions.output,
      ollamaEndpoint: globalOptions.ollamaEndpoint,
      visionModel: globalOptions.ollamaVisionModel,
      textModel: globalOptions.ollamaTextModel,
      customPrompt: globalOptions.ollamaPrompt,
      concurrency: globalOptions.ollamaMaxConcurrency
    });

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
    console.log(`  Concurrency: ${config.concurrency}`);

    const aiClassify = new AIClassify(config);
    await aiClassify.initialize();

    // Handle shutdown signals - 注册在 start() 之前！
    process.on('SIGINT', async () => {
      console.log('\nStopping...');
      await aiClassify.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await aiClassify.stop();
      process.exit(0);
    });

    await aiClassify.start();
  });

// Status command
program
  .command('status')
  .description('Show queue and index status')
  .action(async (options) => {
    const globalOptions = program.opts();
    const projectDir = process.cwd();
    const baseConfig = await loadConfig(projectDir, globalOptions.config);
    const config = mergeWithCliArgs(baseConfig, {
      output: globalOptions.output
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
  .action(async (options) => {
    const globalOptions = program.opts();
    const projectDir = process.cwd();
    const baseConfig = await loadConfig(projectDir, globalOptions.config);
    const config = mergeWithCliArgs(baseConfig, {
      output: globalOptions.output
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
  .action(async (options) => {
    const globalOptions = program.opts();
    const projectDir = process.cwd();
    const baseConfig = await loadConfig(projectDir, globalOptions.config);
    const config = mergeWithCliArgs(baseConfig, {
      input: globalOptions.input,
      output: globalOptions.output
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
  .action(async (options) => {
    const globalOptions = program.opts();
    const projectDir = process.cwd();

    const config: Config = {
      ...DEFAULT_CONFIG,
      input: globalOptions.input || DEFAULT_CONFIG.input,
      output: globalOptions.output || DEFAULT_CONFIG.output,
      ollamaEndpoint: globalOptions.ollamaEndpoint || DEFAULT_CONFIG.ollamaEndpoint
    };

    await saveConfig(projectDir, config);
    console.log('Configuration saved to .ai-classify.json');
  });

program.parse();
