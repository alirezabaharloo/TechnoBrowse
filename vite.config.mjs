import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Single-page build: the dashboard is the only window this app creates.
export default defineConfig({
  base: './', // relative asset URLs so the production build works over file://
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true, // static preview behind the Arena sandbox proxy
  },
});
