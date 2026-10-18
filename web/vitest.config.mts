import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Monorepo'da (node-linker=hoisted) mobil paket React Native için farklı bir React sürümü
// kökte tutabilir. Testlerin tek bir React kopyası kullanması için web'in kendi React'ine sabitliyoruz.
const require = createRequire(import.meta.url);
const reactDir = dirname(require.resolve('react/package.json'));
const reactDomDir = dirname(require.resolve('react-dom/package.json'));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      { find: /^react$/, replacement: `${reactDir}/index.js` },
      { find: /^react\/(.*)$/, replacement: `${reactDir}/$1` },
      { find: /^react-dom$/, replacement: `${reactDomDir}/index.js` },
      { find: /^react-dom\/(.*)$/, replacement: `${reactDomDir}/$1` },
    ],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // CJS bağımlılıkların require('react') çağrıları da tek kopyaya gitsin diye ön-paketleme
    deps: {
      optimizer: {
        web: { enabled: true, include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@testing-library/react', '@tanstack/react-query', 'framer-motion', 'lucide-react'] },
      },
    },
  },
});
