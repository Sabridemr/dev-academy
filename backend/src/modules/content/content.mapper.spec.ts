import type { LessonVersion } from '@prisma/client';
import { toLessonDetail, type LessonWithVersion } from './content.mapper';
import type { Module as ModuleRow } from '@prisma/client';

describe('toLessonDetail', () => {
  it('alıştırma çözümünü istemciye giden bloklardan çıkarır', () => {
    const blocks = [
      {
        id: 'exercise-1',
        order: 0,
        type: 'exercise',
        src: 'x.exercise.json',
        exercise: { id: 'k-06-x', title: 'X', language: 'python', prompt: 'p', starter: '', tests: 'assert 1', hints: [], timeoutMs: 5000 },
        solution: 'GIZLI_COZUM',
      },
    ];
    const version = {
      version: 1,
      publishedAt: new Date('2026-10-01T00:00:00Z'),
      blocks,
      title: 'Ders',
      summary: 'Özet',
      durationMinutes: 10,
      level: 'beginner',
      tags: [],
      prerequisites: [],
      concepts: [],
    } as unknown as LessonVersion;
    const lesson = {
      id: 'k-06',
      slug: 'k-06',
      moduleId: 'k-python',
      order: 6,
      publishedVersion: version,
      module: { id: 'k-python', slug: 'python', code: 'K', title: 'Python' } as unknown as ModuleRow,
    } as unknown as LessonWithVersion & { module: ModuleRow };

    const detail = toLessonDetail(lesson, { prev: null, next: null });
    expect(JSON.stringify(detail)).not.toContain('GIZLI_COZUM');
    expect(detail.blocks[0]).toMatchObject({ type: 'exercise', exercise: { id: 'k-06-x' } });
    // Veritabanındaki blok değişmez (çözüm uç noktası oradan okur)
    expect(blocks[0].solution).toBe('GIZLI_COZUM');
  });
});
