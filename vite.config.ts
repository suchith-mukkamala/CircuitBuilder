import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  test: {
    // Keep tests predictable across shared CI runners.
    testTimeout: 45000,
    maxWorkers: 2,
  },
});
