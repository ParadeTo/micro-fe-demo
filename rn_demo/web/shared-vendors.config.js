import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({ NODE_ENV: 'production' }),
    'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'entries/shared-vendors.js'),
      formats: ['iife'],
      name: 'MicroFeShared',
    },
    outDir: resolve(__dirname, '../../micro-apps/shared'),
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'vendors.js' },
    },
  },
});
