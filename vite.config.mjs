import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Multi-page build: the dashboard (index.html) and the browser chrome (browser.html).
export default defineConfig({
  base: './', // relative asset URLs so the production build works over file://
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        browser: fileURLToPath(new URL('./browser.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
});
