//apps\bingo-frontend\vite.config.ts
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      '@bingogame/crypto-utils': resolve(__dirname, '../../packages/crypto-utils/src'),
      '@bingogame/shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      '@bingogame/translations': resolve(__dirname, '../../packages/translations/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/engine-api': {
        target: 'http://localhost:4000',
        rewrite: (path: string) => path.replace(/^\/engine-api/, ''),
      },
    },
  },
});