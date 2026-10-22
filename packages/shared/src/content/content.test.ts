import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLessonMarkdown, parseDirectiveAttributes, lessonPlainText } from './parser';
import {
  ExerciseSchema,
  LessonBlockSchema,
  QuizSchema,
  stripExerciseSolutions,
  type LessonBlock,
} from './schema';
import { buildSearchText } from './search-text';
import { CURRICULUM, allLessons, findLesson, nextLessonOf, TOTAL_LESSON_COUNT } from './curriculum';

const SAMPLE = `---
id: a-05-load-balancing
slug: load-balancing
module: a-system-design-fundamentals
order: 5
title:
  tr: Load Balancer
  en: Load Balancer
summary: Yük dengeleme
durationMinutes: 20
level: intermediate
tags: [lb, scaling]
concepts: [round-robin]
---
## Kavram

Yük dengeleyici istekleri dağıtır.

:::diagram{src="diagram.svg" alt="LB diyagramı|LB diagram"}
Katmanlı görünüm
:::

:::animation{scene="scene.json"}
:::

:::interactive{type="load-balancer" algorithm="round-robin" servers=3 sticky=false}
Sunucu sayısını değiştirin.
:::

:::code{lang="ts" title="Round robin"}
\`\`\`ts
const next = servers[i++ % servers.length];
\`\`\`
\`\`\`python
nxt = servers[i % len(servers)]
\`\`\`
:::

:::realworld{company="Amazon"}
ELB milyonlarca isteği dağıtır.
:::

:::callout{tone="tip" title="İpucu"}
Health check unutmayın.
:::

Metin arası.

\`\`\`bash
# bu çit içindeki ::: satırı directive değildir
:::
\`\`\`

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-06-api-gateway"}
:::
`;

describe('Ders Markdown ayrıştırıcı', () => {
  it('frontmatter ve blokları çıkarır', () => {
    const doc = parseLessonMarkdown(SAMPLE, { sourcePath: 'test/lesson.md' });
    expect(doc.meta.id).toBe('a-05-load-balancing');
    expect(doc.meta.title).toEqual({ tr: 'Load Balancer', en: 'Load Balancer' });
    const types = doc.blocks.map((b) => b.type);
    expect(types).toEqual(['text', 'diagram', 'animation', 'interactive', 'code', 'realworld', 'callout', 'text', 'quiz', 'next']);
  });

  it('directive özniteliklerini tipli çözer', () => {
    const attrs = parseDirectiveAttributes('{type="load-balancer" servers=3 sticky=false name=\'x\'}');
    expect(attrs).toEqual({ type: 'load-balancer', servers: 3, sticky: false, name: 'x' });
  });

  it('interactive parametrelerini ve çift dilli alt metni çözer', () => {
    const doc = parseLessonMarkdown(SAMPLE);
    const inter = doc.blocks.find((b) => b.type === 'interactive');
    expect(inter && inter.type === 'interactive' && inter.params).toEqual({ algorithm: 'round-robin', servers: 3, sticky: false });
    const diagram = doc.blocks.find((b) => b.type === 'diagram');
    expect(diagram && diagram.type === 'diagram' && diagram.alt).toEqual({ tr: 'LB diyagramı', en: 'LB diagram' });
  });

  it('kod bloğunda alternatif dilleri yakalar', () => {
    const doc = parseLessonMarkdown(SAMPLE);
    const code = doc.blocks.find((b) => b.type === 'code');
    expect(code && code.type === 'code' && code.language).toBe('ts');
    expect(code && code.type === 'code' && code.alternatives[0].language).toBe('python');
  });

  it('kod çiti içindeki ::: satırını directive saymaz', () => {
    const doc = parseLessonMarkdown(SAMPLE);
    const lastText = doc.blocks.filter((b) => b.type === 'text').at(-1);
    expect(lastText && lastText.type === 'text' && lastText.markdown).toContain('Metin arası');
  });

  it('trace directive kaynağını, çift dilli başlığını ve alt yazısını çıkarır', () => {
    const doc = parseLessonMarkdown(
      SAMPLE.replace('## Kavram', ':::trace{src="ornek.trace.json" title="Etiketler|Labels"}\nYığını izle\n:::\n\n## Kavram'),
    );
    const trace = doc.blocks.find((b) => b.type === 'trace');
    expect(trace).toMatchObject({
      type: 'trace',
      src: 'ornek.trace.json',
      title: { tr: 'Etiketler', en: 'Labels' },
      caption: 'Yığını izle',
    });
  });

  it('exercise directive kaynağını ve yönergesini çıkarır', () => {
    const doc = parseLessonMarkdown(
      SAMPLE.replace('## Kavram', ':::exercise{src="toplam.exercise.json"}\nFonksiyonu tamamla|Complete the function\n:::\n\n## Kavram'),
    );
    const ex = doc.blocks.find((b) => b.type === 'exercise');
    expect(ex).toMatchObject({
      type: 'exercise',
      src: 'toplam.exercise.json',
      instructions: { tr: 'Fonksiyonu tamamla', en: 'Complete the function' },
    });
  });

  it('kapatılmamış directive hata verir', () => {
    expect(() => parseLessonMarkdown(SAMPLE.replace(':::next{lesson="a-06-api-gateway"}\n:::', ':::next{lesson="x"}'))).toThrow(/kapatılmamış/);
  });

  it('geçersiz frontmatter hata verir', () => {
    expect(() => parseLessonMarkdown('---\nid: X Y\n---\nmetin')).toThrow(/Frontmatter geçersiz/);
  });

  it('İngilizce paralel metinleri eşler', () => {
    const en = `---\nid: a-05-load-balancing\nslug: load-balancing\nmodule: a-system-design-fundamentals\norder: 5\ntitle: LB\nsummary: LB\n---\n## Concept\n\nThe load balancer distributes requests.\n`;
    const doc = parseLessonMarkdown(SAMPLE, { englishMarkdown: en });
    const first = doc.blocks[0];
    expect(first.type === 'text' && first.markdownEn).toContain('distributes');
  });

  it('düz metin çıkarır', () => {
    const doc = parseLessonMarkdown(SAMPLE);
    expect(lessonPlainText(doc)).toContain('Yük dengeleyici istekleri dağıtır');
  });
});

describe('predict ve resources directive’leri', () => {
  const PREDICT = `:::predict{id="lb-yeni-sunucu"}
Dördüncü sunucu eklenince **ilk istek** nereye gider? | Where does the **first request** go after a fourth server is added?
- [ ] Hep birinci sunucuya | Always to the first server
- [x] Sıradaki sunucuya | To the next server in turn
- [ ] Rastgele bir sunucuya
Açıklama: Round robin sırayı korur.
Yeni sunucu sıraya katılır. | Round robin keeps the order.
:::
`;
  const RESOURCES = `:::resources
- [Designing Data-Intensive Applications](https://dataintensive.net) — kitap — 6. bölüm
- [NGINX load balancing](https://nginx.org/en/docs/http/load_balancing.html) — docs
- [Bir yazı](https://example.org/yazi) — Herhangi bir not
- [Yalın bağlantı](https://example.org/yalin)
:::
`;
  const withBlocks = (extra: string) => SAMPLE.replace(':::animation{scene="scene.json"}', `${extra}\n:::animation{scene="scene.json"}`);

  it('tahmin sorusunu iki dilli soru, seçenek, doğru cevap ve açıklamaya ayırır', () => {
    const doc = parseLessonMarkdown(withBlocks(PREDICT));
    const types = doc.blocks.map((b) => b.type);
    expect(types.indexOf('predict')).toBe(types.indexOf('animation') - 1);
    const block = doc.blocks.find((b) => b.type === 'predict');
    expect(block).toEqual({
      id: 'lb-yeni-sunucu',
      order: 2,
      type: 'predict',
      prompt: {
        tr: 'Dördüncü sunucu eklenince **ilk istek** nereye gider?',
        en: 'Where does the **first request** go after a fourth server is added?',
      },
      options: [
        { id: 'a', text: { tr: 'Hep birinci sunucuya', en: 'Always to the first server' } },
        { id: 'b', text: { tr: 'Sıradaki sunucuya', en: 'To the next server in turn' } },
        { id: 'c', text: { tr: 'Rastgele bir sunucuya' } },
      ],
      correct: 'b',
      explanation: { tr: 'Round robin sırayı korur.\nYeni sunucu sıraya katılır.', en: 'Round robin keeps the order.' },
    });
    expect(LessonBlockSchema.safeParse(block).success).toBe(true);
  });

  it('tahmin sorusunda doğru seçenek sayısı bir değilse ya da id eksikse hata verir', () => {
    expect(() => parseLessonMarkdown(withBlocks(PREDICT.replace('- [ ] Hep', '- [x] Hep')))).toThrow(/tam olarak bir doğru/);
    expect(() => parseLessonMarkdown(withBlocks(PREDICT.replace('- [x] Sıradaki', '- [ ] Sıradaki')))).toThrow(/şu an 0/);
    expect(() => parseLessonMarkdown(withBlocks(PREDICT.replace('{id="lb-yeni-sunucu"}', '')))).toThrow(/'id' özniteliği zorunlu/);
    expect(() => parseLessonMarkdown(withBlocks(PREDICT + '\n' + PREDICT))).toThrow(/benzersiz/);
  });

  it('kaynakça satırlarından başlık, URL, tür ve notu çıkarır', () => {
    const doc = parseLessonMarkdown(withBlocks(RESOURCES));
    const block = doc.blocks.find((b) => b.type === 'resources');
    expect(block && block.type === 'resources' && block.items).toEqual([
      { title: 'Designing Data-Intensive Applications', url: 'https://dataintensive.net', kind: 'book', note: '6. bölüm' },
      { title: 'NGINX load balancing', url: 'https://nginx.org/en/docs/http/load_balancing.html', kind: 'docs', note: undefined },
      { title: 'Bir yazı', url: 'https://example.org/yazi', kind: undefined, note: 'Herhangi bir not' },
      { title: 'Yalın bağlantı', url: 'https://example.org/yalin', kind: undefined, note: undefined },
    ]);
    expect(LessonBlockSchema.safeParse(block).success).toBe(true);
    expect(() => parseLessonMarkdown(withBlocks(':::resources\nDüz metin\n:::'))).toThrow(/biçiminde olmalı/);
  });

  it('şema bilinmeyen doğru seçeneği ve https olmayan URL’yi reddeder', () => {
    const predict = parseLessonMarkdown(withBlocks(PREDICT)).blocks.find((b) => b.type === 'predict');
    expect(LessonBlockSchema.safeParse({ ...predict, correct: 'z' }).success).toBe(false);
    const resources = { id: 'r', order: 0, type: 'resources', items: [{ title: 'X', url: 'http://example.org' }] };
    expect(LessonBlockSchema.safeParse(resources).success).toBe(false);
  });

  it('arama metnine tahmin sorusu girer, kaynakça girmez', () => {
    const doc = parseLessonMarkdown(withBlocks(PREDICT + '\n' + RESOURCES));
    const text = buildSearchText(doc.blocks, 'LB', 'Özet', []);
    expect(text).toContain('Dördüncü sunucu eklenince');
    expect(text).not.toContain('Designing Data-Intensive');
    expect(text).not.toContain('dataintensive.net');
  });
});

describe('Quiz şeması', () => {
  const base = {
    id: 'q-lb',
    title: 'LB Quiz',
    questions: [
      {
        id: 'q1',
        type: 'single',
        prompt: 'Round robin neye bakmaz?',
        options: [
          { id: 'a', text: 'Sıraya' },
          { id: 'b', text: 'Sunucu yüküne' },
        ],
        correct: ['b'],
        explanation: 'Round robin yükü dikkate almaz.',
      },
    ],
  };
  it('geçerli quiz kabul edilir', () => {
    expect(QuizSchema.safeParse(base).success).toBe(true);
  });
  it('bilinmeyen doğru seçenek reddedilir', () => {
    const bad = { ...base, questions: [{ ...base.questions[0], correct: ['z'] }] };
    expect(QuizSchema.safeParse(bad).success).toBe(false);
  });
  it('single tipinde birden fazla doğru reddedilir', () => {
    const bad = { ...base, questions: [{ ...base.questions[0], correct: ['a', 'b'] }] };
    expect(QuizSchema.safeParse(bad).success).toBe(false);
  });
});

describe('Alıştırma şeması', () => {
  const base = {
    id: 'k-06-toplam',
    title: { tr: 'Toplam', en: 'Sum' },
    prompt: { tr: 'Topla', en: 'Sum it' },
    starter: 'def toplam(xs):\n    ...\n',
    solution: 'def toplam(xs):\n    return sum(xs)\n',
    tests: 'assert toplam([1, 2]) == 3\n',
  };
  it('varsayılanları doldurur', () => {
    const ex = ExerciseSchema.parse(base);
    expect(ex.language).toBe('python');
    expect(ex.timeoutMs).toBe(5000);
    expect(ex.hints).toEqual([]);
  });
  it('boş testleri ve bilinmeyen alanı reddeder', () => {
    expect(ExerciseSchema.safeParse({ ...base, tests: '  \n' }).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
  it('stripExerciseSolutions çözümü bloklardan çıkarır', () => {
    const blocks: LessonBlock[] = [
      { id: 'exercise-1', order: 0, type: 'exercise', src: 'x.exercise.json', solution: 'gizli' },
      { id: 'text-1', order: 1, type: 'text', markdown: 'merhaba' },
    ];
    const out = stripExerciseSolutions(blocks);
    expect(out[0]).not.toHaveProperty('solution');
    expect(out[1]).toBe(blocks[1]);
    expect(blocks[0]).toHaveProperty('solution', 'gizli');
  });
});

describe('Müfredat', () => {
  it('her içerik modülü müfredatta ve ders id’leri benzersiz', () => {
    // Modül sayısı sabit yazılmaz: content/modules altındaki klasörlerden türetilir
    const modulesDir = resolve(__dirname, '../../../../content/modules');
    const moduleDirs = readdirSync(modulesDir).filter((d) =>
      statSync(resolve(modulesDir, d)).isDirectory(),
    );
    expect(CURRICULUM).toHaveLength(moduleDirs.length);
    expect(CURRICULUM.map((m) => m.id).sort()).toEqual([...moduleDirs].sort());
    const ids = allLessons().map((x) => x.lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TOTAL_LESSON_COUNT).toBe(ids.length);
  });
  it('ders arama ve sonraki ders', () => {
    expect(findLesson('a-05-load-balancing')?.module.code).toBe('A');
    expect(nextLessonOf('a-13-observability-12-factor')?.id).toBe('b-01-monolith-to-microservices');
    // Modül sınırını aşar: G'nin son dersinden H'nin ilk dersine
    expect(nextLessonOf('g-08-nn-playground')?.id).toBe('h-01-linux-notes');
    expect(nextLessonOf('j-11-odunlesimler-mulakat-ve-ozet')?.id).toBe('k-01-python-nasil-calisir');
    expect(nextLessonOf('k-19-testler-ve-mini-proje')?.id).toBe('l-01-big-o-complexity');
  });
  it('modüller order sırasıyla zincirlenir; son dersin sonrası yok', () => {
    const orders = CURRICULUM.map((m) => m.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    // Her ardışık modül çifti: önceki modülün son dersinden sonrakinin ilk dersine
    for (let i = 0; i < CURRICULUM.length - 1; i++) {
      const prev = CURRICULUM[i];
      const next = CURRICULUM[i + 1];
      const lastOfPrev = prev.lessons[prev.lessons.length - 1];
      expect(nextLessonOf(lastOfPrev.id)?.id, `${prev.id} → ${next.id}`).toBe(next.lessons[0].id);
    }
    const lastModule = CURRICULUM[CURRICULUM.length - 1];
    expect(nextLessonOf(lastModule.lessons[lastModule.lessons.length - 1].id)).toBeUndefined();
  });
});
