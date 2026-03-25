import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    timeout: 60000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@kernel': './src/kernel',
      '@language': './src/language',
      '@evolution': './src/evolution',
      '@engines': './src/engines',
      '@runtime': './src/runtime',
      '@stdlib': './src/stdlib',
      '@types': './src/types',
    },
  },
});
