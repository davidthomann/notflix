import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // hls.js is only reached through the lazy player route; pre-bundle it so the first visit does not hit a stale optimizer cache.
  optimizeDeps: { include: ['hls.js'] },
  // The player chunk is large because of hls.js, but it is lazy-loaded and only fetched when watching.
  build: { chunkSizeWarningLimit: 700 },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
