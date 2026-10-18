import { describe, expect, it } from 'vitest';
import { parseLessonMarkdown, parseDirectiveAttributes, lessonPlainText } from './parser';
import { QuizSchema } from './schema';
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

describe('Müfredat', () => {
  it('7 modül ve benzersiz ders id’leri', () => {
    expect(CURRICULUM).toHaveLength(7);
    const ids = allLessons().map((x) => x.lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TOTAL_LESSON_COUNT).toBe(ids.length);
  });
  it('ders arama ve sonraki ders', () => {
    expect(findLesson('a-05-load-balancing')?.module.code).toBe('A');
    expect(nextLessonOf('a-13-observability-12-factor')?.id).toBe('b-01-monolith-to-microservices');
    expect(nextLessonOf('g-08-nn-playground')).toBeUndefined();
  });
});
