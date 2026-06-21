import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        battleCanvasDemo: resolve(__dirname, 'battle-canvas-demo.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@trinitywar/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@trinitywar/battle-canvas-core': resolve(__dirname, '../../packages/battle-canvas-core/src/index.ts'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 6001,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
});
