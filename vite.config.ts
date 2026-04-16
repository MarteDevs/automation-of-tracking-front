import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      // Redirige /api/* → http://localhost:8000/api/*
      // Esto elimina el CORS completamente en desarrollo
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[Vite Proxy ERROR]', err.message);
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[Vite Proxy →]', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('[Vite Proxy ←]', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions', 'mixed-decls']
      }
    }
  }
})
