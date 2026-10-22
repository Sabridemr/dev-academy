/**
 * Kodlama alıştırmalarını (`*.exercise.json`) GERÇEKTEN çalıştırarak sınar (python3 gerekir).
 * Çalıştır: pnpm content:exercises  (kökten)
 *
 * Her alıştırma için:
 *   1. starter sözdizimi geçerli mi (derlenebilir mi)
 *   2. solution + tests → `python3 -I -c` ile 5 sn içinde hatasız bitmeli (testler geçer)
 *   3. starter + tests → başarısız olmalı (testler gerçekten bir şey sınıyor; starter hazır çözüm değil)
 *
 * İçerik doğrulayıcısı (pnpm content:validate) yalnızca yapıyı doğrular; Node'da Python çalıştırılmaz.
 * Çıkış kodu: herhangi bir alıştırma başarısızsa 1.
 */
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { findContentRoot, loadContent } from '../src/node/content-loader';

const TIMEOUT_MS = 5000;

interface RunResult {
  ok: boolean;
  timedOut: boolean;
  output: string;
}

function runPython(args: string[], input?: string): RunResult {
  const res = spawnSync('python3', ['-I', ...args], {
    input,
    timeout: TIMEOUT_MS,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', PYTHONHASHSEED: '0', PYTHONIOENCODING: 'utf-8' },
  });
  if (res.error && (res.error as NodeJS.ErrnoException).code === 'ENOENT') {
    console.error('✗ python3 bulunamadı; alıştırmalar sınanamadı');
    process.exit(2);
  }
  const timedOut =
    res.signal === 'SIGTERM' || (res.error as NodeJS.ErrnoException)?.code === 'ETIMEDOUT';
  return {
    ok: res.status === 0 && !timedOut,
    timedOut,
    output: `${res.stdout ?? ''}${res.stderr ?? ''}`.trim(),
  };
}

const root = findContentRoot();
const content = loadContent(root);
let total = 0;
const failures: string[] = [];

for (const m of content.modules) {
  for (const l of m.lessons) {
    for (const [file, ex] of Object.entries(l.exercises)) {
      total += 1;
      const where = relative(root, join(l.dir, file)).replace(/\\/g, '/');
      const fail = (msg: string, output?: string) =>
        failures.push(
          `${where} (${ex.id}): ${msg}${output ? `\n      ${output.split('\n').slice(-6).join('\n      ')}` : ''}`,
        );

      const compiled = runPython(
        ['-c', "import sys; compile(sys.stdin.read(), '<starter>', 'exec')"],
        ex.starter,
      );
      if (!compiled.ok) fail('starter derlenemiyor (sözdizimi hatası)', compiled.output);

      const solved = runPython(['-c', `${ex.solution}\n${ex.tests}`]);
      if (!solved.ok)
        fail(
          solved.timedOut ? `çözüm ${TIMEOUT_MS} ms içinde bitmedi` : 'çözüm testleri geçmiyor',
          solved.output,
        );

      const starter = runPython(['-c', `${ex.starter}\n${ex.tests}`]);
      if (starter.ok) fail('starter testleri geçiyor: testler zayıf ya da starter hazır çözüm');
    }
  }
}

if (failures.length) {
  console.log(`✗ ${failures.length} sorun (${total} alıştırma):`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`✓ ${total} alıştırma: çözümler testleri geçiyor, başlangıç kodları geçmiyor`);
