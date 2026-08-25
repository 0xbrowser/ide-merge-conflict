import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Monaco resolves its worker modules at runtime; keep them as real modules.
    exclude: ['monaco-editor'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
