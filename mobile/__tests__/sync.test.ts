import type {
  LessonDetail,
  ModuleDetail,
  OfflineBundle,
  QuizPublic,
  SceneResponse,
} from '@devacademy/shared';
import { applyBundle, type SqlDb } from '@/offline/db';
import { mergeProgress } from '@/offline/queue';
import { syncModule, type SyncDeps } from '@/offline/sync';

/**
 * Çevrimdışı senkron: SQLite sahte (mock) bir veritabanı ile upsert mantığı, ETag / 304 akışı
 * ve ilerleme kuyruğu birleştirme kuralları.
 */

/** SQL çağrılarını kaydeden ve basit bir tablo modeli tutan sahte veritabanı */
function createFakeDb() {
  const calls: { sql: string; params: (string | number | null)[] }[] = [];
  const tables = {
    lessons: new Map<string, Record<string, unknown>>(),
    scenes: new Map<string, Record<string, unknown>>(),
    quizzes: new Map<string, Record<string, unknown>>(),
    modules: new Map<string, Record<string, unknown>>(),
  };
  let inTransaction = false;
  const transactionLog: boolean[] = [];

  const db: SqlDb = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async (sql: string, params: (string | number | null)[]) => {
      calls.push({ sql, params });
      transactionLog.push(inTransaction);
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('INSERT INTO lessons')) {
        const [id, module_id, slug, json, version] = params;
        tables.lessons.set(String(id), { id, module_id, slug, json, version });
      } else if (s.startsWith('INSERT INTO scenes')) {
        const [id, module_id, json, version] = params;
        tables.scenes.set(String(id), { id, module_id, json, version });
      } else if (s.startsWith('INSERT INTO quizzes')) {
        const [id, lesson_id, module_id, json] = params;
        tables.quizzes.set(String(id), { id, lesson_id, module_id, json });
      } else if (s.startsWith('INSERT INTO modules')) {
        const [id, json, etag, synced_at] = params;
        const prev = tables.modules.get(String(id));
        tables.modules.set(String(id), { id, json: json ?? prev?.json ?? null, etag, synced_at });
      } else if (s.startsWith('UPDATE modules SET synced_at')) {
        const [synced_at, id] = params;
        const prev = tables.modules.get(String(id));
        if (prev) tables.modules.set(String(id), { ...prev, synced_at });
      } else if (s.startsWith('DELETE FROM lessons WHERE module_id = ? AND id NOT IN')) {
        const [moduleId, ...keep] = params;
        for (const [id, row] of tables.lessons)
          if (row.module_id === moduleId && !keep.includes(id)) tables.lessons.delete(id);
      } else if (s === 'DELETE FROM lessons WHERE module_id = ?') {
        const [moduleId] = params;
        for (const [id, row] of tables.lessons)
          if (row.module_id === moduleId) tables.lessons.delete(id);
      }
      return { changes: 1 };
    }),
    getFirstAsync: jest.fn(async (sql: string, params: (string | number | null)[]) => {
      if (sql.startsWith('SELECT etag FROM modules')) {
        const row = tables.modules.get(String(params[0]));
        return row ? { etag: row.etag } : null;
      }
      return null;
    }) as unknown as SqlDb['getFirstAsync'],
    getAllAsync: jest.fn(async () => []) as unknown as SqlDb['getAllAsync'],
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
      inTransaction = true;
      try {
        await task();
      } finally {
        inTransaction = false;
      }
    }),
  };
  return { db, calls, tables, transactionLog };
}

function lesson(id: string, moduleId = 'a-mod', version = 1): LessonDetail {
  return {
    id,
    slug: id,
    moduleId,
    order: 1,
    title: { tr: id },
    summary: { tr: '' },
    durationMinutes: 10,
    level: 'beginner',
    tags: [],
    hasAnimation: true,
    hasInteractive: false,
    hasQuiz: true,
    version,
    publishedAt: '2026-01-01T00:00:00.000Z',
    blocks: [],
    prerequisites: [],
    concepts: [],
    next: null,
    prev: null,
    module: { id: moduleId, slug: moduleId, code: 'A', title: { tr: 'Modül' } },
  };
}

const scene: SceneResponse = {
  id: 'scene-1',
  version: 3,
  updatedAt: '2026-01-01',
  scene: {} as SceneResponse['scene'],
};
const quiz: QuizPublic = {
  id: 'quiz-1',
  lessonId: 'l1',
  title: { tr: 'Quiz' },
  passScore: 70,
  questions: [],
};
const moduleDetail = {
  id: 'a-mod',
  slug: 'a-mod',
  code: 'A',
  order: 1,
  title: { tr: 'Modül' },
  description: { tr: '' },
  icon: 'book',
  color: '#6366f1',
  lessonCount: 2,
  lessons: [],
} as ModuleDetail;

function bundle(lessons: LessonDetail[]): OfflineBundle {
  return {
    generatedAt: '2026-01-01',
    moduleId: 'a-mod',
    lessons,
    scenes: [scene],
    quizzes: [quiz],
  };
}

describe('offline applyBundle (SQLite upsert)', () => {
  it('dersleri, sahneleri, quizleri ve modülü tek transaction içinde yazar', async () => {
    const { db, tables, transactionLog } = createFakeDb();
    const counts = await applyBundle(
      db,
      bundle([lesson('l1'), lesson('l2')]),
      moduleDetail,
      'W/"abc"',
      '2026-02-01T00:00:00.000Z',
    );

    expect(counts).toEqual({ lessons: 2, scenes: 1, quizzes: 1 });
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(transactionLog.every(Boolean)).toBe(true);
    expect([...tables.lessons.keys()].sort()).toEqual(['l1', 'l2']);
    expect(JSON.parse(String(tables.lessons.get('l1')?.json)).id).toBe('l1');
    expect(tables.scenes.get('scene-1')).toMatchObject({ module_id: 'a-mod', version: 3 });
    expect(tables.quizzes.get('quiz-1')).toMatchObject({ lesson_id: 'l1', module_id: 'a-mod' });
    expect(tables.modules.get('a-mod')).toMatchObject({
      etag: 'W/"abc"',
      synced_at: '2026-02-01T00:00:00.000Z',
    });
  });

  it('upsert: aynı ders yeni sürümle güncellenir, paketten çıkan ders silinir', async () => {
    const { db, tables, calls } = createFakeDb();
    await applyBundle(db, bundle([lesson('l1'), lesson('l2')]), moduleDetail, 'v1');
    await applyBundle(db, bundle([lesson('l1', 'a-mod', 2)]), null, 'v2');

    expect([...tables.lessons.keys()]).toEqual(['l1']);
    expect(tables.lessons.get('l1')?.version).toBe(2);
    // Modül JSON'u verilmediğinde önceki korunur (COALESCE)
    expect(tables.modules.get('a-mod')?.json).toBe(JSON.stringify(moduleDetail));
    expect(calls.some((c) => /ON CONFLICT\(id\) DO UPDATE/.test(c.sql))).toBe(true);
  });
});

describe('offline applyBundle (boş paket)', () => {
  it('sıfır dersli paket gelirse modülün eski dersleri silinir', async () => {
    const { db, tables } = createFakeDb();
    await applyBundle(db, bundle([lesson('l1'), lesson('l2')]), moduleDetail, 'v1');
    await applyBundle(db, bundle([]), null, 'v2');
    expect(tables.lessons.size).toBe(0);
  });
});

describe('syncModule (ETag / 304)', () => {
  function deps(overrides: Partial<SyncDeps>, db: SqlDb): Partial<SyncDeps> {
    const etags = new Map<string, string>();
    return {
      db,
      fetchModule: jest.fn(async () => moduleDetail),
      etags: {
        get: (id) => etags.get(id) ?? null,
        set: (id, e) => (e ? etags.set(id, e) : etags.delete(id)) as unknown as void,
      },
      now: () => '2026-03-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('ilk indirmede paketi yazar ve ETag’i saklar', async () => {
    const { db, tables } = createFakeDb();
    const fetchBundle = jest.fn(async () => ({
      status: 200,
      data: bundle([lesson('l1')]),
      etag: 'W/"e1"',
      notModified: false,
    }));
    const d = deps({ fetchBundle }, db);
    const res = await syncModule('a-mod', d);

    expect(res).toEqual({
      moduleId: 'a-mod',
      status: 'updated',
      lessons: 1,
      scenes: 1,
      quizzes: 1,
    });
    expect(fetchBundle).toHaveBeenCalledWith('a-mod', null);
    expect(d.etags!.get('a-mod')).toBe('W/"e1"');
    expect(tables.lessons.has('l1')).toBe(true);
  });

  it('saklı ETag’i If-None-Match olarak gönderir; 304’te içerik yazılmaz', async () => {
    const { db, tables } = createFakeDb();
    const first = jest.fn(async () => ({
      status: 200,
      data: bundle([lesson('l1')]),
      etag: 'W/"e1"',
      notModified: false,
    }));
    const d = deps({ fetchBundle: first }, db);
    await syncModule('a-mod', d);
    const lessonWrites = (db.runAsync as jest.Mock).mock.calls.filter(([sql]: [string]) =>
      sql.includes('INSERT INTO lessons'),
    ).length;

    const second = jest.fn(async () => ({
      status: 304,
      data: null,
      etag: 'W/"e1"',
      notModified: true,
    }));
    const res = await syncModule('a-mod', { ...d, fetchBundle: second });

    expect(res).toEqual({ moduleId: 'a-mod', status: 'not_modified' });
    expect(second).toHaveBeenCalledWith('a-mod', 'W/"e1"');
    const lessonWritesAfter = (db.runAsync as jest.Mock).mock.calls.filter(([sql]: [string]) =>
      sql.includes('INSERT INTO lessons'),
    ).length;
    expect(lessonWritesAfter).toBe(lessonWrites);
    expect(tables.modules.get('a-mod')?.synced_at).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('ilerleme kuyruğu birleştirme', () => {
  it('yüzdenin en büyüğünü, sürelerin toplamını, tamamlandı bilgisini OR ile tutar', () => {
    const a = { lessonId: 'l1', percent: 40, secondsSpent: 30, lastBlockId: 'b2', queuedAt: 't1' };
    const b = { lessonId: 'l1', percent: 20, secondsSpent: 15, completed: true, queuedAt: 't2' };
    expect(mergeProgress(a, b)).toEqual({
      lessonId: 'l1',
      percent: 40,
      secondsSpent: 45,
      lastBlockId: 'b2',
      completed: true,
      queuedAt: 't2',
    });
    expect(mergeProgress(undefined, b)).toBe(b);
  });
});
