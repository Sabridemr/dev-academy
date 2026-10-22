import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installHarness, PY_HARNESS, runWithPyodide, type PyodideLike } from './harness';
import { PyodideRunner, type WorkerLike } from './runner';
import type { WorkerRequest, WorkerResponse } from './protocol';

/**
 * Gerçek Pyodide jsdom'da çalıştırılmaz: harness sahte bir Pyodide ile, Python tarafı (PY_HARNESS)
 * varsa yerel python3 ile, çalıştırıcı (worker yaşam döngüsü, zaman aşımı) sahte bir Worker ile sınanır.
 */

function fakePyodide(harnessOutput: unknown, print: string[] = []) {
  let stdout: (line: string) => void = () => undefined;
  const destroy = vi.fn();
  const call = vi.fn((_code: string, _tests?: string) => {
    for (const p of print) stdout(p);
    return JSON.stringify(harnessOutput);
  });
  const py: PyodideLike = {
    runPython: vi.fn(),
    setStdout: (o) => {
      stdout = o.batched;
    },
    setStderr: vi.fn(),
    setStdin: vi.fn(),
    globals: { get: () => Object.assign(call, { destroy }) },
  };
  return { py, call, destroy };
}

describe('Pyodide harness', () => {
  it('kurulumda Python harness çalışır ve stdin kapatılır', () => {
    const { py } = fakePyodide({ ok: true });
    installHarness(py);
    expect(py.runPython).toHaveBeenCalledWith(PY_HARNESS);
    expect(py.setStdin).toHaveBeenCalledWith({ error: true });
  });

  it('çalıştır modunda testler gönderilmez, stdout yakalanır, proxy serbest bırakılır', () => {
    const { py, call, destroy } = fakePyodide({ ok: true }, ['merhaba', '42']);
    const res = runWithPyodide(py, { code: 'print(1)', tests: 'assert 1', mode: 'run' });
    expect(call).toHaveBeenCalledWith('print(1)', undefined);
    expect(res).toMatchObject({ status: 'ok', stdout: 'merhaba\n42' });
    expect(destroy).toHaveBeenCalled();
  });

  it('başarısız test satırını ve metnini raporlar', () => {
    const { py } = fakePyodide({
      ok: false,
      phase: 'tests',
      errorType: 'AssertionError',
      error: 'Traceback…\nAssertionError\n',
      testLine: 2,
    });
    const res = runWithPyodide(py, {
      code: 'x = 1',
      tests: 'assert x == 1\nassert x == 2\n',
      mode: 'test',
    });
    expect(res).toMatchObject({
      status: 'failed',
      errorType: 'AssertionError',
      testLine: 2,
      testSource: 'assert x == 2',
    });
  });

  it('kullanıcı kodundaki hata "error" olur', () => {
    const { py } = fakePyodide({ ok: false, phase: 'code', errorType: 'NameError', error: 'x' });
    expect(runWithPyodide(py, { code: 'y', mode: 'test', tests: 'assert 1' }).status).toBe('error');
  });

  const python = spawnSync('python3', ['--version']).status === 0;
  it.skipIf(!python)('Python harness gerçek CPython ile doğru sonuç üretir', () => {
    const driver = `${PY_HARNESS}
import json
print(json.dumps([
    json.loads(_da_run("def f(x):\\n    return x * 2\\n", "assert f(2) == 4\\nassert f(3) == 7\\n")),
    json.loads(_da_run("print('a')", None)),
    json.loads(_da_run("x = (", None)),
    json.loads(_da_run("input()", None)),
]))`;
    const out = spawnSync('python3', ['-I', '-c', driver], { encoding: 'utf8' });
    const [failed, ok, syntax, input] = JSON.parse(out.stdout.trim().split('\n').pop()!);
    expect(failed).toMatchObject({
      ok: false,
      phase: 'tests',
      errorType: 'AssertionError',
      testLine: 2,
    });
    expect(failed.error).toContain('<testler>');
    expect(failed.error).not.toContain('_da_run');
    expect(ok).toEqual({ ok: true });
    expect(syntax).toMatchObject({ ok: false, phase: 'code', errorType: 'SyntaxError' });
    expect(input).toMatchObject({ ok: false, errorType: 'RuntimeError' });
  });
});

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  sent: WorkerRequest[] = [];
  terminated = false;
  constructor(private readonly behavior: 'ok' | 'hang' | 'fail-init') {}
  postMessage(msg: WorkerRequest) {
    this.sent.push(msg);
    queueMicrotask(() => {
      if (msg.type === 'init') {
        this.emit(
          this.behavior === 'fail-init'
            ? { type: 'init-error', message: 'yok' }
            : { type: 'ready' },
        );
      } else if (this.behavior === 'ok') {
        this.emit({
          type: 'result',
          id: msg.id,
          result: { status: 'ok', stdout: msg.request.code, stderr: '' },
        });
      }
    });
  }
  terminate() {
    this.terminated = true;
  }
  private emit(data: WorkerResponse) {
    this.onmessage?.({ data } as MessageEvent<WorkerResponse>);
  }
}

describe('PyodideRunner', () => {
  afterEach(() => vi.useRealTimers());

  it('worker tembel yaratılır, bir kez yüklenir ve sonuç döner', async () => {
    const workers: FakeWorker[] = [];
    const runner = new PyodideRunner(() => {
      const w = new FakeWorker('ok');
      workers.push(w);
      return w;
    });
    const states: string[] = [];
    runner.subscribe((s) => states.push(s));
    expect(workers).toHaveLength(0);
    const a = await runner.run({ code: 'a', mode: 'run' }, 1000);
    const b = await runner.run({ code: 'b', mode: 'run' }, 1000);
    expect(a.stdout).toBe('a');
    expect(b.stdout).toBe('b');
    expect(workers).toHaveLength(1);
    expect(workers[0].sent[0]).toEqual({ type: 'init', indexURL: '/pyodide/' });
    expect(states).toEqual(['loading', 'ready']);
  });

  it('süre aşılınca worker sonlandırılır ve sonraki çalıştırmada yeniden kurulur', async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const runner = new PyodideRunner(() => {
      const w = new FakeWorker(workers.length === 0 ? 'hang' : 'ok');
      workers.push(w);
      return w;
    });
    const pending = runner.run({ code: 'while True: pass', mode: 'run' }, 500);
    await vi.advanceTimersByTimeAsync(600);
    expect(await pending).toMatchObject({ status: 'timeout' });
    expect(workers[0].terminated).toBe(true);
    expect(runner.state).toBe('idle');

    const next = runner.run({ code: 'ok', mode: 'run' }, 500);
    await vi.advanceTimersByTimeAsync(10);
    expect(await next).toMatchObject({ status: 'ok', stdout: 'ok' });
    expect(workers).toHaveLength(2);
  });

  it('yükleme hatası "crashed" döner ve durum error olur', async () => {
    const runner = new PyodideRunner(() => new FakeWorker('fail-init'));
    const res = await runner.run({ code: 'x', mode: 'run' }, 1000);
    expect(res.status).toBe('crashed');
    expect(runner.state).toBe('error');
  });
});
