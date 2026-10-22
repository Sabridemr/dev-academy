// sql.js'in WebAssembly ikilisini node_modules'tan web/public/sql.js/ altına kopyalar.
// SQL oyun alanı simülatörü wasm'ı CDN'den değil kendi origin'imizden yükler (CSP 'self').
// predev/prebuild ile otomatik çalışır; çıktı .gitignore'dadır (sürüm paketle birlikte güncellenir).
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const src = require.resolve('sql.js/dist/sql-wasm.wasm');
const outDir = join(here, '..', 'public', 'sql.js');
const dest = join(outDir, 'sql-wasm.wasm');

mkdirSync(outDir, { recursive: true });
let upToDate = false;
try {
  const a = statSync(src);
  const b = statSync(dest);
  upToDate = a.size === b.size && a.mtimeMs <= b.mtimeMs;
} catch {
  // hedef yok
}
if (!upToDate) {
  copyFileSync(src, dest);
  console.log(`[copy-sqljs] ${src} → public/sql.js/sql-wasm.wasm`);
}
