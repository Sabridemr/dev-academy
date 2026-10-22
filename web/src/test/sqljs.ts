import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';

/**
 * Testlerde gerçek sql.js (SQLite WebAssembly) motoru. jsdom ortamında Emscripten kendini tarayıcı sanıp
 * wasm'ı fetch ile indirmeye çalışır; ikili dosyayı node_modules'tan okuyup doğrudan veriyoruz.
 */
const require = createRequire(import.meta.url);

export function loadTestSqlJs() {
  const bytes = readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
  const wasmBinary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return initSqlJs({ wasmBinary: wasmBinary as ArrayBuffer });
}
