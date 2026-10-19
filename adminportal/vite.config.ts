//apps\bingo-frontend\vite.config.ts
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        cookieDomainRewrite: '',  // <-- strips domain so cookie applies to proxy origin
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Log Set-Cookie header for debugging
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('Set-Cookie:', setCookie);
            }
          });
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying:', req.method, req.url, '->', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`Proxy response: ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('Set-Cookie:', setCookie);
            }
          });
        },
      },
    },
  },
});