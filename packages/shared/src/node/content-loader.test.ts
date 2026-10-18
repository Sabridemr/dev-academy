import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from './content-loader';

/** İçerik doğrulayıcı kuralları: gerçek A-05 dersinin geçici bir kopyası üzerinde bozulma senaryoları */
const REAL = resolve(__dirname, '../../../../content');
const MODULE = 'a-system-design-fundamentals';
const LESSON = 'a-05-load-balancing';

let root = '';

function fixture(paths: unknown[] = [{ id: 'p', slug: 'p', title: 'P', description: 'P', items: [`${MODULE}/${LESSON}`] }]): string {
  root = mkdtempSync(join(tmpdir(), 'da-content-'));
  cpSync(join(REAL, 'modules', MODULE, 'module.json'), join(root, 'modules', MODULE, 'module.json'), { recursive: true });
  cpSync(join(REAL, 'modules', MODULE, LESSON), join(root, 'modules', MODULE, LESSON), { recursive: true });
  writeFileSync(join(root, 'paths.json'), JSON.stringify(paths));
  return join(root, 'modules', MODULE, LESSON);
}

const errors = () => loadContent(root).issues.filter((i) => i.severity === 'error');

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = '';
});

describe('içerik doğrulayıcı', () => {
  it('bozulmamış ders hatasız yüklenir', () => {
    fixture();
    expect(errors()).toEqual([]);
  });

  it('simülatörün okumadığı interaktif parametreyi hata sayar', () => {
    const dir = fixture();
    const md = join(dir, 'lesson.md');
    writeFileSync(md, readFileSync(md, 'utf8').replace(':::interactive{type="load-balancer" ', ':::interactive{type="load-balancer" healthChecks=true '));
    expect(errors().map((e) => e.message)).toEqual([expect.stringContaining('bilinmeyen parametre: healthChecks')]);
  });

  it('3 sorudan az quiz hata verir', () => {
    const dir = fixture();
    const qf = join(dir, 'quiz.json');
    const quiz = JSON.parse(readFileSync(qf, 'utf8'));
    quiz.questions = quiz.questions.slice(0, 2);
    writeFileSync(qf, JSON.stringify(quiz));
    expect(errors().map((e) => e.message)).toEqual([expect.stringContaining('3–6 soru içermeli (şu an 2)')]);
  });

  it('paths.json bilinmeyen modül ya da derse işaret ederse hata verir', () => {
    fixture([{ id: 'p', slug: 'p', title: 'P', description: 'P', items: [`${MODULE}/yok-boyle-ders`, 'yok-modul'] }]);
    const messages = errors().map((e) => e.message);
    expect(messages).toEqual(expect.arrayContaining([expect.stringContaining('bilinmeyen ders yok-boyle-ders'), expect.stringContaining('bilinmeyen modül yok-modul')]));
  });
});
