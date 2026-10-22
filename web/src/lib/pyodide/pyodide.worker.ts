/**
 * Pyodide Web Worker'ı. Python ana iş parçacığını kilitlemesin ve sonsuz döngüde worker
 * `terminate` edilebilsin diye kod burada çalışır. Pyodide, public/pyodide/'dan (aynı origin)
 * çalışma anında yüklenir; webpack paketine girmez.
 */
import { installHarness, runWithPyodide, type PyodideLike } from './harness';
import type { WorkerRequest, WorkerResponse } from './protocol';

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}
const scope = self as unknown as WorkerScope;

let pyodide: Promise<PyodideLike> | null = null;

async function load(indexURL: string): Promise<PyodideLike> {
  const url = new URL(`${indexURL}pyodide.mjs`, self.location.origin).toString();
  const mod = (await import(/* webpackIgnore: true */ url)) as {
    loadPyodide(options: { indexURL: string }): Promise<PyodideLike>;
  };
  const py = await mod.loadPyodide({
    indexURL: new URL(indexURL, self.location.origin).toString(),
  });
  installHarness(py);
  return py;
}

scope.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'init') {
    pyodide ??= load(msg.indexURL);
    pyodide.then(
      () => scope.postMessage({ type: 'ready' }),
      (err: unknown) => {
        pyodide = null;
        scope.postMessage({ type: 'init-error', message: String(err) });
      },
    );
    return;
  }
  if (msg.type === 'run') {
    void (async () => {
      try {
        const py = await (pyodide ?? Promise.reject(new Error('Pyodide yüklenmedi')));
        scope.postMessage({ type: 'result', id: msg.id, result: runWithPyodide(py, msg.request) });
      } catch (err) {
        scope.postMessage({
          type: 'result',
          id: msg.id,
          result: { status: 'crashed', stdout: '', stderr: '', error: String(err) },
        });
      }
    })();
  }
};
