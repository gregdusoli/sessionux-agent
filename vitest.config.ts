import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 75,
        branches: 60,
        functions: 75,
        lines: 80,
      },
    },
  },
});
