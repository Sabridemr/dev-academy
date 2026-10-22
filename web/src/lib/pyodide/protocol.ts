import type { RunRequest, RunResult } from './harness';

/** Ana iş parçacığı → worker */
export type WorkerRequest =
  { type: 'init'; indexURL: string } | { type: 'run'; id: number; request: RunRequest };

/** Worker → ana iş parçacığı */
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'result'; id: number; result: RunResult };

/** Pyodide dosyalarının yolu (web/scripts/copy-pyodide.mjs, aynı origin) */
export const PYODIDE_INDEX_URL = '/pyodide/';
