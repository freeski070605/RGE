import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_RGE_API_PROXY_TARGET || 'http://localhost:4010';

  return {
    plugins: [react()],
    server: {
      port: 4173,
      proxy: {
        '/api': proxyTarget,
        '/media': proxyTarget,
        '/assets': proxyTarget
      }
    }
  };
});
