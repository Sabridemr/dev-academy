/**
 * Kodlama alıştırması çalıştırıcısı: Pyodide (WebAssembly CPython) üzerinde kullanıcı kodu + testler.
 * Bu dosya saf mantıktır (Worker'dan bağımsız); pyodide.worker.ts onu Pyodide örneğiyle çağırır,
 * birim testleri sahte bir Pyodide ile.
 *
 * Kod hiçbir zaman sunucuya gönderilmez.
 */

export type RunMode = 'run' | 'test';

export interface RunRequest {
  code: string;
  /** mode = 'test' iken kullanıcı kodundan sonra aynı ad alanında çalışır */
  tests?: string;
  mode: RunMode;
}

export type RunStatus = 'ok' | 'error' | 'failed' | 'timeout' | 'crashed';

export interface RunResult {
  /**
   * ok: hatasız bitti (test modunda: testler geçti) · error: kullanıcı kodu hata fırlattı ·
   * failed: testlerden biri başarısız · timeout: süre aşıldı · crashed: çalıştırıcı yüklenemedi/çöktü
   */
  status: RunStatus;
  stdout: string;
  stderr: string;
  /** Python traceback'i (yalnızca kullanıcı kodu ve test çerçeveleri) */
  error?: string;
  errorType?: string;
  /** Başarısız testin satır numarası ve metni */
  testLine?: number;
  testSource?: string;
}

/** Çıktı üst sınırı: döngüde print eden kod sekmeyi dondurmasın */
export const MAX_OUTPUT_CHARS = 20_000;

/**
 * Python tarafı: kod ve testler ayrı dosya adlarıyla (<kod>, <testler>) derlenir; traceback'ten
 * çalıştırıcının kendi çerçeveleri ayıklanır. Sonuç JSON metni olarak döner (PyProxy sızmaz).
 * Her çalıştırma yeni bir ad alanında başlar.
 */
export const PY_HARNESS = String.raw`
import json as _da_json
import traceback as _da_tb

def _da_input(prompt=""):
    raise RuntimeError("input() burada desteklenmez; değerleri koda yazın (input() is not supported here)")

def _da_run(code, tests):
    ns = {"__name__": "__main__", "input": _da_input}
    phase = "code"
    try:
        exec(compile(code, "<kod>", "exec"), ns)
        if tests is not None:
            phase = "tests"
            exec(compile(tests, "<testler>", "exec"), ns)
        return _da_json.dumps({"ok": True})
    except BaseException as e:
        te = _da_tb.TracebackException.from_exception(e)
        frames = [f for f in te.stack if f.filename in ("<kod>", "<testler>")]
        test_line = None
        for f in frames:
            if f.filename == "<testler>":
                test_line = f.lineno
        if isinstance(e, SyntaxError) and e.filename == "<testler>":
            test_line = e.lineno
        te.stack = _da_tb.StackSummary.from_list(frames)
        return _da_json.dumps({
            "ok": False,
            "phase": phase,
            "errorType": type(e).__name__,
            "error": "".join(te.format()),
            "testLine": test_line,
        })
`;

/** Pyodide API'sinin kullandığımız alt kümesi (testlerde sahtesi verilir) */
export interface PyodideLike {
  runPython(code: string): unknown;
  setStdout(options: { batched: (line: string) => void }): void;
  setStderr(options: { batched: (line: string) => void }): void;
  setStdin(options: { error: boolean }): void;
  globals: { get(name: string): unknown };
}

interface HarnessOutput {
  ok: boolean;
  phase?: 'code' | 'tests';
  errorType?: string;
  error?: string;
  testLine?: number | null;
}

function capped(lines: string[]): string {
  const text = lines.join('\n');
  return text.length > MAX_OUTPUT_CHARS
    ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n… (çıktı kısaltıldı / output truncated)`
    : text;
}

/** Çalıştırıcıyı Pyodide'a bir kez kurar (yüklemeden hemen sonra) */
export function installHarness(py: PyodideLike): void {
  py.runPython(PY_HARNESS);
  // input() tarayıcı çalıştırıcısında desteklenmez: beklemek yerine hemen hata versin
  py.setStdin({ error: true });
}

/** Tek bir çalıştırma: stdout/stderr yakalanır, test hatası satırıyla raporlanır */
export function runWithPyodide(py: PyodideLike, req: RunRequest): RunResult {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let outLen = 0;
  const sink = (target: string[]) => (line: string) => {
    if (outLen > MAX_OUTPUT_CHARS) return;
    outLen += line.length + 1;
    target.push(line);
  };
  py.setStdout({ batched: sink(stdout) });
  py.setStderr({ batched: sink(stderr) });

  // undefined → Python None (null, Pyodide'da None değil JsNull olur)
  const tests = req.mode === 'test' ? (req.tests ?? '') : undefined;
  const fn = py.globals.get('_da_run') as ((code: string, tests?: string) => string) & {
    destroy?: () => void;
  };
  let parsed: HarnessOutput;
  try {
    parsed = JSON.parse(fn(req.code, tests)) as HarnessOutput;
  } finally {
    fn.destroy?.();
  }

  const base = { stdout: capped(stdout), stderr: capped(stderr) };
  if (parsed.ok) return { status: 'ok', ...base };
  const failedTest = parsed.phase === 'tests';
  const testLine = failedTest && parsed.testLine ? parsed.testLine : undefined;
  return {
    status: failedTest ? 'failed' : 'error',
    ...base,
    error: parsed.error,
    errorType: parsed.errorType,
    testLine,
    testSource: testLine && tests ? tests.split('\n')[testLine - 1]?.trim() : undefined,
  };
}
