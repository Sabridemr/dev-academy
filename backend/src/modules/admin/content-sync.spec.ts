import { decideSeedAction, hash, versionFingerprint } from './content-sync';

describe('decideSeedAction (seed panel koruması)', () => {
  const base = { contentFingerprint: 'c2', lastSeedContentHash: 'c1', force: false };

  it('yayındaki sürüm content/ ile aynıysa değişiklik yok', () => {
    expect(decideSeedAction({ ...base, published: { source: 'admin', fingerprint: 'c2' } })).toBe(
      'unchanged',
    );
  });

  it('ders hiç yayınlanmamışsa ya da yayındaki sürüm seed kaynaklıysa yazar', () => {
    expect(decideSeedAction({ ...base, published: null })).toBe('write');
    expect(decideSeedAction({ ...base, published: { source: 'seed', fingerprint: 'x' } })).toBe(
      'write',
    );
  });

  it("panel sürümü var ve content/ son seed'den beri aynı: atlar", () => {
    expect(
      decideSeedAction({
        ...base,
        lastSeedContentHash: 'c2',
        published: { source: 'admin', fingerprint: 'panel' },
      }),
    ).toBe('skip-admin');
  });

  it('seed bu dersi hiç yazmamışsa (panelde oluşturulmuş) atlar', () => {
    expect(
      decideSeedAction({
        ...base,
        lastSeedContentHash: null,
        published: { source: 'admin', fingerprint: 'panel' },
      }),
    ).toBe('skip-admin');
  });

  it('content/ değiştiyse ya da --force verildiyse panel sürümünü ezer', () => {
    const published = { source: 'admin' as const, fingerprint: 'panel' };
    expect(decideSeedAction({ ...base, published })).toBe('overwrite-admin');
    expect(decideSeedAction({ ...base, lastSeedContentHash: 'c2', published, force: true })).toBe(
      'overwrite-admin',
    );
  });
});

describe('versionFingerprint', () => {
  it('anahtar sırasından ve undefined alanlardan bağımsızdır', () => {
    const a = {
      title: { tr: 'A', en: undefined },
      summary: 'S',
      durationMinutes: 5,
      level: 'beginner',
      tags: [],
      prerequisites: [],
      concepts: [],
      blocks: [{ type: 'text', id: 't', order: 0, markdown: 'x' }],
    };
    const b = {
      ...a,
      title: { tr: 'A' },
      blocks: [{ markdown: 'x', order: 0, id: 't', type: 'text' }],
    };
    expect(versionFingerprint(a)).toBe(versionFingerprint(b));
    expect(hash({ a: 1 })).not.toBe(hash({ a: 2 }));
  });
});
