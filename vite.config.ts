import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
} as never);
