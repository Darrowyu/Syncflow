import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['VITE_', 'SERVER_']);
  const port = parseInt(env.VITE_PORT) || 3000;
  const apiPort = parseInt(env.SERVER_PORT) || parseInt(env.VITE_API_PORT) || 3001;
  return {
    server: {
      port,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
        '/uploads': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } }
  };
});
