import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(currentDir, '..'), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || `http://localhost:${env.PORT || 4000}`;

  return {
    plugins: [react()],
    envDir: path.resolve(currentDir, '..'),
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: false,
        },
      },
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
