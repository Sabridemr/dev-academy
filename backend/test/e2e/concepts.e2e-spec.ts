import { lessonId, prefix, useE2eApp } from './helpers';

describe('Kavram sözlüğü (e2e)', () => {
  const e2e = useE2eApp();

  it('sözlüğü anonim listeler; ETag ile 304 döner', async () => {
    const res = await e2e.http.get(`${prefix}/concepts`).expect(200);
    expect(res.body.length).toBeGreaterThan(100);
    expect(res.body).toContainEqual(
      expect.objectContaining({
        id: 'round-robin',
        term: expect.objectContaining({ tr: expect.any(String), en: expect.any(String) }),
        definition: expect.objectContaining({ tr: expect.any(String) }),
        lessonCount: expect.any(Number),
      }),
    );
    expect(res.headers['cache-control']).toContain('public');
    await e2e.http.get(`${prefix}/concepts`).set('If-None-Match', res.headers.etag).expect(304);
  });

  it('q ile arar; geçersiz q 400 verir', async () => {
    const res = await e2e.http.get(`${prefix}/concepts?q=round-robin`).expect(200);
    expect(res.body[0].id).toBe('round-robin');
    await e2e.http.get(`${prefix}/concepts?q=${'x'.repeat(101)}`).expect(400);
  });

  it('detayda geçtiği dersleri ve ilgili kavramları döner; bilinmeyen kavram 404', async () => {
    const res = await e2e.http.get(`${prefix}/concepts/round-robin`).expect(200);
    expect(res.body.lessons.map((l: { id: string }) => l.id)).toContain(lessonId);
    expect(res.body.lessons[0]).toEqual(
      expect.objectContaining({ slug: expect.any(String), moduleCode: expect.any(String) }),
    );
    expect(res.body.related.length).toBeGreaterThan(0);
    expect(res.body.questionCount).toBeGreaterThan(0);
    await e2e.http.get(`${prefix}/concepts/yok-boyle-kavram`).expect(404);
  });
});
