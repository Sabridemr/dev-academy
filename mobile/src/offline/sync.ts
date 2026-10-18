import type { ModuleDetail, OfflineBundle } from '@devacademy/shared';
import type { RawResponse } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { kv, KV_KEYS } from '@/lib/storage';
import {
  applyBundle,
  deleteModule,
  getDb,
  getModuleEtag,
  listDownloadedModules,
  touchModuleSync,
  upsertModule,
  type SqlDb,
} from './db';

/**
 * ÇEVRİMDIŞI SENKRON
 * ------------------
 * GET /offline/modules/:id → OfflineBundle (dersler + sahneler + quizler).
 * Daha önce indirilmişse saklanan ETag If-None-Match ile gönderilir; 304 gelirse yalnızca
 * senkron zamanı güncellenir, 200 gelirse paket tek transaction ile SQLite'a yazılır.
 * ETag hem SQLite (modules.etag) hem MMKV'de (hızlı erişim) tutulur.
 */

export interface SyncDeps {
  db: SqlDb;
  fetchBundle: (moduleId: string, etag: string | null) => Promise<RawResponse<OfflineBundle>>;
  /** Modül ağacı (ders listesi) — çevrimdışı modül ekranı için; hata verirse null */
  fetchModule: (moduleId: string) => Promise<ModuleDetail | null>;
  etags: { get(moduleId: string): string | null; set(moduleId: string, etag: string | null): void };
  now: () => string;
}

export type SyncResult =
  | { moduleId: string; status: 'updated'; lessons: number; scenes: number; quizzes: number }
  | { moduleId: string; status: 'not_modified' };

const etagKey = (moduleId: string) => KV_KEYS.etag(`offline.${moduleId}`);

export const mmkvEtags: SyncDeps['etags'] = {
  get: (moduleId) => kv.getString(etagKey(moduleId)) ?? null,
  set: (moduleId, etag) => {
    if (etag) kv.set(etagKey(moduleId), etag);
    else kv.delete(etagKey(moduleId));
  },
};

async function defaultFetchModule(id: string): Promise<ModuleDetail | null> {
  try {
    return await endpoints.module(id);
  } catch {
    return null;
  }
}

/** Verilmeyen bağımlılıkları gerçek uygulamalarla tamamlar */
async function resolveDeps(deps?: Partial<SyncDeps>): Promise<SyncDeps> {
  return {
    db: deps?.db ?? (await getDb()),
    fetchBundle: deps?.fetchBundle ?? ((id, etag) => endpoints.offlineModule(id, etag)),
    fetchModule: deps?.fetchModule ?? defaultFetchModule,
    etags: deps?.etags ?? mmkvEtags,
    now: deps?.now ?? (() => new Date().toISOString()),
  };
}

/** Tek bir modülü indirir ya da günceller */
export async function syncModule(moduleId: string, deps?: Partial<SyncDeps>): Promise<SyncResult> {
  const d = await resolveDeps(deps);
  const syncedAt = d.now();
  const etag = d.etags.get(moduleId) ?? (await getModuleEtag(d.db, moduleId));

  const [res, module] = await Promise.all([d.fetchBundle(moduleId, etag), d.fetchModule(moduleId)]);

  if (res.notModified || !res.data) {
    if (module) await upsertModule(d.db, moduleId, module, etag, syncedAt);
    else await touchModuleSync(d.db, moduleId, syncedAt);
    kv.set(KV_KEYS.lastSyncAt, syncedAt);
    return { moduleId, status: 'not_modified' };
  }

  const counts = await applyBundle(d.db, res.data, module, res.etag, syncedAt);
  d.etags.set(moduleId, res.etag);
  kv.set(KV_KEYS.lastSyncAt, syncedAt);
  return { moduleId, status: 'updated', ...counts };
}

/** İndirilmiş modülü cihazdan kaldırır */
export async function removeModuleDownload(moduleId: string): Promise<void> {
  const db = await getDb();
  await deleteModule(db, moduleId);
  mmkvEtags.set(moduleId, null);
}

/**
 * Uygulama açılışında (çevrimiçiyse) indirilmiş tüm modülleri ETag ile tazeler.
 * Hatalar yutulur; bir modülün başarısızlığı diğerlerini engellemez.
 */
export async function refreshDownloadedModules(): Promise<SyncResult[]> {
  let downloaded: { id: string }[] = [];
  try {
    downloaded = await listDownloadedModules();
  } catch {
    return [];
  }
  const results: SyncResult[] = [];
  for (const m of downloaded) {
    try {
      results.push(await syncModule(m.id));
    } catch {
      // ağ hatası vb. — bir sonraki açılışta tekrar denenir
    }
  }
  return results;
}

export function lastSyncAt(): string | null {
  return kv.getString(KV_KEYS.lastSyncAt) ?? null;
}
