import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', 'VITE_'); // 加载VITE_前缀的环境变量
    const port = parseInt(env.VITE_PORT) || 3000;
    return {
      server: { port, host: '0.0.0.0' },
      plugins: [react()],
      resolve: { alias: { '@': path.resolve(__dirname, './src') } }
    };
});
