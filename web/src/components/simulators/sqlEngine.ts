import type { SqlJsStatic } from 'sql.js';

/**
 * sql.js (SQLite'ın WebAssembly derlemesi) tembel yükleyicisi. Paket yalnızca SQL oyun alanı açıldığında
 * indirilir; wasm ikilisi CDN'den değil kendi origin'imizden (`/sql.js/sql-wasm.wasm`) gelir.
 * Dosya `web/scripts/copy-sqljs.mjs` ile node_modules'tan public/ altına kopyalanır (predev/prebuild).
 * CSP'deki 'wasm-unsafe-eval' (Shiki için zaten var) WebAssembly derlemesine izin verir.
 */
export const SQL_WASM_URL = '/sql.js/sql-wasm.wasm';

let engine: Promise<SqlJsStatic> | null = null;

export function loadSqlEngine(): Promise<SqlJsStatic> {
  if (!engine) {
    engine = import('sql.js')
      .then((m) => m.default({ locateFile: () => SQL_WASM_URL }))
      .catch((err: unknown) => {
        // Bir sonraki denemede yeniden indirilebilsin
        engine = null;
        throw err;
      });
  }
  return engine;
}
