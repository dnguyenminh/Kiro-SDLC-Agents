import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/__tests__/**/*.vitest.ts'],
    testTimeout: 30000,
  },
});
