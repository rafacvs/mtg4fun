import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Polling also detects edits made on Windows through Docker bind mounts.
    watch: { usePolling: true, interval: 500 },
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080', changeOrigin: false, ws: true } },
  },
});
