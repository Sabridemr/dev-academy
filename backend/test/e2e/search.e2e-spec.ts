import { lessonId, prefix, useE2eApp, type Http } from './helpers';

describe('DevAcademy API (e2e)', () => {
  const e2e = useE2eApp();
  let http: Http;
  beforeAll(() => {
    ({ http } = e2e);
  });

  describe('search', () => {
    it('ders ve kavram arar', async () => {
      const res = await http.get(`${prefix}/search`).query({ q: 'round-robin' }).expect(200);
      expect(res.body.results.some((r: { id: string }) => r.id === lessonId)).toBe(true);
    });
    it('full-text eşleşmesi yoksa alt dize yedeğiyle bulur', async () => {
      const res = await http.get(`${prefix}/search`).query({ q: 'robi' }).expect(200);
      expect(res.body.results.some((r: { id: string }) => r.id === lessonId)).toBe(true);
    });
    it('modül başlığını büyük/küçük harf duyarsız ve iki dilde arar', async () => {
      const en = await http.get(`${prefix}/search`).query({ q: 'FUNDAMENTALS' }).expect(200);
      expect(
        en.body.results.some(
          (r: { type: string; id: string }) =>
            r.type === 'module' && r.id === 'a-system-design-fundamentals',
        ),
      ).toBe(true);
      const tr = await http.get(`${prefix}/search`).query({ q: 'sistem tasar' }).expect(200);
      expect(
        tr.body.results.some(
          (r: { type: string; id: string }) =>
            r.type === 'module' && r.id === 'a-system-design-fundamentals',
        ),
      ).toBe(true);
    });
    it('çok kısa sorgu boş döner', async () => {
      const res = await http.get(`${prefix}/search`).query({ q: 'a' }).expect(200);
      expect(res.body.results).toEqual([]);
    });
  });
});
