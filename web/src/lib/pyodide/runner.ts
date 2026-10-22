import type { RunRequest, RunResult } from './harness';
import { PYODIDE_INDEX_URL, type WorkerRequest, type WorkerResponse } from './protocol';

/**
 * Ana iş parçacığındaki Pyodide çalıştırıcısı. Worker ilk kullanımda (tembel) yaratılır ve Pyodide
 * yüklenir; sayfadaki tüm alıştırmalar aynı worker'ı sırayla kullanır. Bir çalıştırma `timeoutMs`'i
 * aşarsa (ör. sonsuz döngü) worker `terminate` edilir; sonraki çalıştırma yenisini kurar.
 */

export type RunnerState = 'idle' | 'loading' | 'ready' | 'error';

/** Worker'ın kullandığımız alt kümesi (testlerde sahtesi verilir) */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

function createPyodideWorker(): WorkerLike {
  return new Worker(new URL('./pyodide.worker.ts', import.meta.url), {
    type: 'module',
    name: 'pyodide',
  }) as unknown as WorkerLike;
}

/** Pyodide (~13 MB) ilk yüklemede yavaş ağda uzun sürebilir */
const LOAD_TIMEOUT_MS = 120_000;

export class PyodideRunner {
  private worker: WorkerLike | null = null;
  private readyPromise: Promise<void> | null = null;
  private pending = new Map<number, (result: RunResult) => void>();
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(state: RunnerState) => void>();
  state: RunnerState = 'idle';

  constructor(
    private readonly createWorker: () => WorkerLike = createPyodideWorker,
    private readonly loadTimeoutMs = LOAD_TIMEOUT_MS,
  ) {}

  subscribe(listener: (state: RunnerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(state: RunnerState) {
    this.state = state;
    for (const l of this.listeners) l(state);
  }

  /** Worker'ı ve Pyodide'ı yükler (zaten yüklüyse hemen döner) */
  ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.setState('loading');
    const worker = this.createWorker();
    this.worker = worker;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => fail('Pyodide yüklenemedi: zaman aşımı'), this.loadTimeoutMs);
      const fail = (message: string) => {
        clearTimeout(timer);
        this.reset();
        this.setState('error');
        reject(new Error(message));
      };
      worker.onerror = (e) => fail(e.message || 'Worker hatası');
      worker.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === 'ready') {
          clearTimeout(timer);
          this.setState('ready');
          resolve();
        } else if (msg.type === 'init-error') {
          fail(msg.message);
        } else if (msg.type === 'result') {
          this.pending.get(msg.id)?.(msg.result);
          this.pending.delete(msg.id);
        }
      };
      worker.postMessage({ type: 'init', indexURL: PYODIDE_INDEX_URL });
    });
    return this.readyPromise;
  }

  /** Kodu çalıştırır; çalıştırmalar sıraya alınır, süre yalnızca çalıştırmanın kendisi için işler */
  run(request: RunRequest, timeoutMs: number): Promise<RunResult> {
    const job = this.queue.then(() => this.runNow(request, timeoutMs));
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async runNow(request: RunRequest, timeoutMs: number): Promise<RunResult> {
    try {
      await this.ensureReady();
    } catch (err) {
      return { status: 'crashed', stdout: '', stderr: '', error: (err as Error).message };
    }
    const worker = this.worker!;
    const id = this.nextId++;
    return new Promise<RunResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // Python'u kesmenin güvenli yolu worker'ı öldürmek (SharedArrayBuffer/COOP gerektirmez)
        this.reset();
        resolve({ status: 'timeout', stdout: '', stderr: '' });
      }, timeoutMs);
      this.pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      worker.postMessage({ type: 'run', id, request });
    });
  }

  /** Worker'ı sonlandırır; bir sonraki çalıştırma Pyodide'ı yeniden yükler */
  reset(): void {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    for (const resolve of this.pending.values())
      resolve({
        status: 'crashed',
        stdout: '',
        stderr: '',
        error: 'Çalıştırıcı yeniden başlatıldı',
      });
    this.pending.clear();
    this.setState('idle');
  }
}

let shared: PyodideRunner | null = null;

/** Sayfa genelinde tek çalıştırıcı (tek worker, tek Pyodide yüklemesi) */
export function getPyodideRunner(): PyodideRunner {
  shared ??= new PyodideRunner();
  return shared;
}
