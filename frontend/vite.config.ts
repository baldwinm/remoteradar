/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // "build" (not Vite's default "dist"): the backend serves the site from frontend/build.
    outDir: 'build',
    sourcemap: false,
    // mapbox-gl is ~1.8 MB on its own; it is loaded lazily, only on city pages.
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 3000,
    // In development the API runs separately (uvicorn on :8000); proxy it so the app
    // can always call same-origin /api/... URLs, exactly like in production.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
