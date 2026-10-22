/**
 * Pyodide (WebAssembly CPython) çalışma zamanı dosyalarını node_modules/pyodide'dan public/pyodide/'a
 * kopyalar. Kodlama alıştırmaları Python'u tarayıcıda, bir Web Worker içinde bu dosyalarla çalıştırır;
 * CDN kullanılmaz (ev sunucusu internete kapalı olabilir, CSP aynı origin'le sınırlı kalır).
 * `pnpm dev` ve `pnpm build` öncesinde çalışır (web/package.json). Çıktı gitignore'dadır.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const src = dirname(require.resolve('pyodide/package.json'));
const { version } = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pyodide');

// Tarayıcıda gereken dosyalar (Node'a özgü, kaynak haritası ve konsol HTML'leri hariç)
const FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'pyodide-lock.json',
  'python_stdlib.zip',
];

mkdirSync(out, { recursive: true });
const stamp = join(out, 'VERSION');
const upToDate =
  existsSync(stamp) &&
  readFileSync(stamp, 'utf8').trim() === version &&
  FILES.every(
    (f) => existsSync(join(out, f)) && statSync(join(out, f)).size === statSync(join(src, f)).size,
  );

if (upToDate) {
  console.log(`✓ pyodide ${version} public/pyodide içinde güncel`);
} else {
  for (const f of FILES) copyFileSync(join(src, f), join(out, f));
  writeFileSync(stamp, `${version}\n`);
  console.log(`✓ pyodide ${version} → public/pyodide (${FILES.length} dosya)`);
}
