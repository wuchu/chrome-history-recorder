import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['packages/**/test/**/*.test.ts'],
    exclude: ['node_modules/**', '**/node_modules/**', 'dist', '.wxt'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', '.wxt', '**/*.d.ts'],
    },
  },
});
