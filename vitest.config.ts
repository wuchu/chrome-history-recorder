import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Tests import package source directly so they do not require a prior
    // `tsc` build of vfs/ai.
    alias: {
      vfs: path.resolve(rootDir, 'packages/vfs/src/lib.ts'),
      ai: path.resolve(rootDir, 'packages/ai/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['packages/**/test/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '**/node_modules/**', 'dist', '.wxt'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', '.wxt', '**/*.d.ts'],
    },
  },
});
