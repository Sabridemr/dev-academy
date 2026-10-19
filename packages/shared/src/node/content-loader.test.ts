import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent, translationReport } from './content-loader';
import { readImageSize } from './image-size';

/** İçerik doğrulayıcı kuralları: gerçek A-05 dersinin geçici bir kopyası üzerinde bozulma senaryoları */
const REAL = resolve(__dirname, '../../../../content');
const MODULE = 'a-system-design-fundamentals';
const LESSON = 'a-05-load-balancing';

let root = '';

function fixture(
  paths: unknown[] = [
    { id: 'p', slug: 'p', title: 'P', description: 'P', items: [`${MODULE}/${LESSON}`] },
  ],
): string {
  root = mkdtempSync(join(tmpdir(), 'da-content-'));
  cpSync(
    join(REAL, 'modules', MODULE, 'module.json'),
    join(root, 'modules', MODULE, 'module.json'),
    { recursive: true },
  );
  cpSync(join(REAL, 'modules', MODULE, LESSON), join(root, 'modules', MODULE, LESSON), {
    recursive: true,
  });
  writeFileSync(join(root, 'paths.json'), JSON.stringify(paths));
  return join(root, 'modules', MODULE, LESSON);
}

const errors = () => loadContent(root).issues.filter((i) => i.severity === 'error');

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = '';
});

/** 3×2 piksellik geçerli PNG (yalnızca başlık okunur) */
const PNG_3x2 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000030000000208060000009d74066a0000000d4944415478da63f8ffff3f0300050001fe4c9a840000000049454e44ae426082',
  'hex',
);

describe('readImageSize', () => {
  it('PNG, JPEG ve WebP boyutunu başlıktan okur; tanınmayan veride null döner', () => {
    expect(readImageSize(PNG_3x2)).toEqual({ width: 3, height: 2 });
    // SOI + APP0 (boş) + SOF0 (yükseklik 480, genişlik 640)
    const jpeg = Buffer.from('ffd8ffe00002ffc0000b0801e002800301110000', 'hex');
    expect(readImageSize(jpeg)).toEqual({ width: 640, height: 480 });
    const webp = Buffer.alloc(30);
    webp.write('RIFF', 0, 'ascii');
    webp.write('WEBPVP8X', 8, 'ascii');
    webp.writeUIntLE(1199, 24, 3);
    webp.writeUIntLE(799, 27, 3);
    expect(readImageSize(webp)).toEqual({ width: 1200, height: 800 });
    expect(readImageSize(Buffer.from('bu bir görsel değil'))).toBeNull();
  });
});

describe('içerik doğrulayıcı', () => {
  it('bozulmamış ders hatasız yüklenir', () => {
    fixture();
    expect(errors()).toEqual([]);
  });

  it('simülatörün okumadığı interaktif parametreyi hata sayar', () => {
    const dir = fixture();
    const md = join(dir, 'lesson.md');
    writeFileSync(
      md,
      readFileSync(md, 'utf8').replace(
        ':::interactive{type="load-balancer" ',
        ':::interactive{type="load-balancer" healthChecks=true ',
      ),
    );
    expect(errors().map((e) => e.message)).toEqual([
      expect.stringContaining('bilinmeyen parametre: healthChecks'),
    ]);
  });

  it('3 sorudan az quiz hata verir', () => {
    const dir = fixture();
    const qf = join(dir, 'quiz.json');
    const quiz = JSON.parse(readFileSync(qf, 'utf8'));
    quiz.questions = quiz.questions.slice(0, 2);
    writeFileSync(qf, JSON.stringify(quiz));
    expect(errors().map((e) => e.message)).toEqual([
      expect.stringContaining('3–6 soru içermeli (şu an 2)'),
    ]);
  });

  it('paths.json bilinmeyen modül ya da derse işaret ederse hata verir', () => {
    fixture([
      {
        id: 'p',
        slug: 'p',
        title: 'P',
        description: 'P',
        items: [`${MODULE}/yok-boyle-ders`, 'yok-modul'],
      },
    ]);
    const messages = errors().map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('bilinmeyen ders yok-boyle-ders'),
        expect.stringContaining('bilinmeyen modül yok-modul'),
      ]),
    );
  });
});

describe('translationReport', () => {
  it('gövdesi tamamen çevrilmiş dersleri ve İngilizcesi olan kısa metinleri sayar', () => {
    const lesson = (id: string, markdownEn?: string) => ({
      doc: {
        meta: { id, title: { tr: 'Başlık', en: 'Title' }, summary: 'Özet' },
        blocks: [
          { id: 't', order: 0, type: 'text', markdown: 'Metin', markdownEn },
          { id: 'd', order: 1, type: 'diagram', src: 'd.svg', alt: { tr: 'Alt' } },
        ],
      },
    });
    const report = translationReport({
      modules: [{ lessons: [lesson('a', 'Text'), lesson('b')] }],
    } as never);
    expect(report.lessonsWithEnglishBody).toBe(1);
    expect(report.untranslatedLessons).toEqual(['b']);
    expect(report.localizedFields).toBe(6);
    expect(report.localizedFieldsWithEnglish).toBe(2);
  });
});

describe('içerik doğrulayıcı: ders görselleri', () => {
  it('ders klasöründeki raster görseli diyagram olarak kabul eder ve boyutunu okur', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'sayfa-01.png'), PNG_3x2);
    const md = join(dir, 'lesson.md');
    writeFileSync(
      md,
      `${readFileSync(md, 'utf8')}\n:::diagram{src="sayfa-01.png" alt="Sayfa 1"}\n:::\n`,
    );
    const content = loadContent(root);
    expect(content.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(content.modules[0].lessons[0].images['sayfa-01.png']).toMatchObject({
      width: 3,
      height: 2,
    });
  });

  it('bozuk görsel dosyasını ve olmayan görsel referansını hata sayar', () => {
    const dir = fixture();
    writeFileSync(join(dir, 'bozuk.png'), 'png değil');
    const md = join(dir, 'lesson.md');
    writeFileSync(md, `${readFileSync(md, 'utf8')}\n:::diagram{src="yok.jpg" alt="Yok"}\n:::\n`);
    const messages = errors().map((e) => e.message);
    expect(messages).toContainEqual(expect.stringContaining('Görsel okunamadı'));
    expect(messages).toContainEqual(
      expect.stringContaining('Diyagram dosyası bulunamadı: yok.jpg'),
    );
  });
});
