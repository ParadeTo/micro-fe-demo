import react from '@vitejs/plugin-react';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { transformWithEsbuild } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createWebConfig(name, entryFromRnDemoRoot) {
  const outDir = resolve(__dirname, '../../micro-apps', name);

  return {
    plugins: [
      // Transform JSX inside .js files (RN source) before Vite's import analysis
      {
        name: 'treat-js-as-jsx',
        enforce: 'pre',
        async transform(code, id) {
          if (!id.match(/\.js$/)) return null;
          return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
        },
      },
      react(),
      {
        name: 'write-html-entry',
        closeBundle() {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(
            resolve(outDir, 'index.html'),
            `<div></div>\n<script src="./${name}.js"></script>\n`,
          );
        },
      },
    ],
    resolve: {
      alias: { 'react-native': 'react-native-web' },
    },
    build: {
      lib: {
        entry: resolve(__dirname, '..', entryFromRnDemoRoot),
        formats: ['iife'],
        name: toPascalCase(name) + 'App',
      },
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        output: { entryFileNames: `${name}.js` },
      },
    },
  };
}

function toPascalCase(str) {
  return str.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}
