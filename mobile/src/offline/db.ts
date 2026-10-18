import * as SQLite from 'expo-sqlite';
import type { LessonDetail, ModuleDetail, OfflineBundle, QuizPublic, SceneResponse } from '@devacademy/shared';

/**
 * ÇEVRİMDIŞI İÇERİK VERİTABANI (expo-sqlite)
 * ------------------------------------------
 * Tablolar:
 *   lessons(id, module_id, json, version, updated_at)
 *   scenes(id, module_id, json, version)
 *   quizzes(id, lesson_id, module_id, json)
 *   modules(id, json, etag, synced_at)
 * JSON sütunları API DTO'larını olduğu gibi saklar; böylece çevrimdışı okuma, çevrimiçi
 * yanıtla aynı tipi döndürür. Şema sürümü PRAGMA user_version ile yönetilir.
 */

/** Kullandığımız expo-sqlite alt kümesi — testlerde sahte uygulama ile değiştirilebilir */
export interface SqlDb {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(source: string, params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: (string | number | null)[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export const DB_NAME = 'devacademy-offline.db';
export const SCHEMA_VERSION = 1;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY NOT NULL,
      module_id TEXT NOT NULL,
      slug TEXT,
      json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_slug ON lessons(slug);
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY NOT NULL,
      module_id TEXT,
      json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY NOT NULL,
      lesson_id TEXT NOT NULL,
      module_id TEXT,
      json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON quizzes(lesson_id);
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY NOT NULL,
      json TEXT,
      etag TEXT,
      synced_at TEXT
    );
  `,
};

let dbPromise: Promise<SqlDb> | null = null;

async function migrate(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
    await db.execAsync(MIGRATIONS[v]);
    await db.execAsync(`PRAGMA user_version = ${v}`);
  }
}

/** Tekil veritabanı bağlantısı (ilk çağrıda açılır ve göç uygulanır) */
export function getDb(): Promise<SqlDb> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const native = await SQLite.openDatabaseAsync(DB_NAME);
      await native.execAsync('PRAGMA journal_mode = WAL;');
      const db = native as unknown as SqlDb;
      await migrate(db);
      return db;
    })().catch((e: unknown) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

/** Testler için bağlantı önbelleğini sıfırlar */
export function resetDbForTests(): void {
  dbPromise = null;
}

/* ------------------------------ Yazma ------------------------------ */

export async function upsertLesson(db: SqlDb, lesson: LessonDetail): Promise<void> {
  await db.runAsync(
    `INSERT INTO lessons (id, module_id, slug, json, version, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET module_id = excluded.module_id, slug = excluded.slug, json = excluded.json,
       version = excluded.version, updated_at = excluded.updated_at`,
    [lesson.id, lesson.moduleId, lesson.slug, JSON.stringify(lesson), lesson.version ?? 0, lesson.publishedAt ?? new Date().toISOString()],
  );
}

export async function upsertScene(db: SqlDb, scene: SceneResponse, moduleId: string | null): Promise<void> {
  await db.runAsync(
    `INSERT INTO scenes (id, module_id, json, version) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET module_id = excluded.module_id, json = excluded.json, version = excluded.version`,
    [scene.id, moduleId, JSON.stringify(scene), scene.version ?? 0],
  );
}

export async function upsertQuiz(db: SqlDb, quiz: QuizPublic, moduleId: string | null): Promise<void> {
  await db.runAsync(
    `INSERT INTO quizzes (id, lesson_id, module_id, json) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET lesson_id = excluded.lesson_id, module_id = excluded.module_id, json = excluded.json`,
    [quiz.id, quiz.lessonId, moduleId, JSON.stringify(quiz)],
  );
}

export async function upsertModule(db: SqlDb, moduleId: string, module: ModuleDetail | null, etag: string | null, syncedAt: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO modules (id, json, etag, synced_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET json = COALESCE(excluded.json, modules.json), etag = excluded.etag, synced_at = excluded.synced_at`,
    [moduleId, module ? JSON.stringify(module) : null, etag, syncedAt],
  );
}

export async function touchModuleSync(db: SqlDb, moduleId: string, syncedAt: string): Promise<void> {
  await db.runAsync('UPDATE modules SET synced_at = ? WHERE id = ?', [syncedAt, moduleId]);
}

/**
 * Bir çevrimdışı paketi tek işlemde (transaction) veritabanına yazar.
 * Pakette artık bulunmayan (yayından kalkmış) dersler silinir.
 */
export async function applyBundle(
  db: SqlDb,
  bundle: OfflineBundle,
  module: ModuleDetail | null,
  etag: string | null,
  syncedAt: string = new Date().toISOString(),
): Promise<{ lessons: number; scenes: number; quizzes: number }> {
  await db.withTransactionAsync(async () => {
    for (const lesson of bundle.lessons) await upsertLesson(db, lesson);
    for (const scene of bundle.scenes) await upsertScene(db, scene, bundle.moduleId);
    for (const quiz of bundle.quizzes) await upsertQuiz(db, quiz, bundle.moduleId);
    const keepIds = bundle.lessons.map((l) => l.id);
    if (keepIds.length > 0) {
      const placeholders = keepIds.map(() => '?').join(', ');
      await db.runAsync(`DELETE FROM lessons WHERE module_id = ? AND id NOT IN (${placeholders})`, [bundle.moduleId, ...keepIds]);
    } else {
      // Modülde yayında ders kalmadıysa yereldeki tüm dersleri sil
      await db.runAsync('DELETE FROM lessons WHERE module_id = ?', [bundle.moduleId]);
    }
    await upsertModule(db, bundle.moduleId, module, etag, syncedAt);
  });
  return { lessons: bundle.lessons.length, scenes: bundle.scenes.length, quizzes: bundle.quizzes.length };
}

export async function deleteModule(db: SqlDb, moduleId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM lessons WHERE module_id = ?', [moduleId]);
    await db.runAsync('DELETE FROM scenes WHERE module_id = ?', [moduleId]);
    await db.runAsync('DELETE FROM quizzes WHERE module_id = ?', [moduleId]);
    await db.runAsync('DELETE FROM modules WHERE id = ?', [moduleId]);
  });
}

/* ------------------------------ Okuma ------------------------------ */

function parse<T>(row: { json: string | null } | null): T | null {
  if (!row?.json) return null;
  try {
    return JSON.parse(row.json) as T;
  } catch {
    return null;
  }
}

export async function readLesson(idOrSlug: string): Promise<LessonDetail | null> {
  const db = await getDb();
  return parse<LessonDetail>(await db.getFirstAsync<{ json: string }>('SELECT json FROM lessons WHERE id = ? OR slug = ? LIMIT 1', [idOrSlug, idOrSlug]));
}

export async function readScene(id: string): Promise<SceneResponse | null> {
  const db = await getDb();
  return parse<SceneResponse>(await db.getFirstAsync<{ json: string }>('SELECT json FROM scenes WHERE id = ? LIMIT 1', [id]));
}

export async function readQuizByLesson(lessonId: string): Promise<QuizPublic | null> {
  const db = await getDb();
  return parse<QuizPublic>(await db.getFirstAsync<{ json: string }>('SELECT json FROM quizzes WHERE lesson_id = ? LIMIT 1', [lessonId]));
}

export async function readModule(idOrSlug: string): Promise<ModuleDetail | null> {
  const db = await getDb();
  const direct = parse<ModuleDetail>(await db.getFirstAsync<{ json: string }>('SELECT json FROM modules WHERE id = ? LIMIT 1', [idOrSlug]));
  if (direct) return direct;
  const all = await db.getAllAsync<{ json: string | null }>('SELECT json FROM modules', []);
  return all.map((r) => parse<ModuleDetail>(r)).find((m) => m?.slug === idOrSlug) ?? null;
}

export interface DownloadedModule {
  id: string;
  etag: string | null;
  syncedAt: string | null;
  lessonCount: number;
  module: ModuleDetail | null;
}

export async function listDownloadedModules(): Promise<DownloadedModule[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; json: string | null; etag: string | null; synced_at: string | null; lesson_count: number }>(
    `SELECT m.id, m.json, m.etag, m.synced_at, (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id) AS lesson_count
     FROM modules m ORDER BY m.id`,
    [],
  );
  return rows.map((r) => ({ id: r.id, etag: r.etag, syncedAt: r.synced_at, lessonCount: r.lesson_count, module: parse<ModuleDetail>(r) }));
}

export async function getModuleEtag(db: SqlDb, moduleId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ etag: string | null }>('SELECT etag FROM modules WHERE id = ?', [moduleId]);
  return row?.etag ?? null;
}
