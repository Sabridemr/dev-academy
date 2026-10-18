import type { AttemptResult, SubmitAttemptDto, UpdateProgressDto } from '@devacademy/shared';
import { isApiError } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { getJson, kv, KV_KEYS, setJson } from '@/lib/storage';

/**
 * ÇEVRİMDIŞI KUYRUKLAR (MMKV)
 * ---------------------------
 * 1) İlerleme: ders başına tek kayıt tutulur (yüzde = max, süre = toplam, tamamlandı = OR).
 *    Böylece çevrimdışı uzun bir oturum tek PUT isteğine indirgenir.
 * 2) Quiz denemeleri: doğru cevaplar istemcide olmadığı için çevrimdışı puanlanamaz;
 *    deneme saklanır ve çevrimiçi olunca gönderilir.
 */

export interface QueuedProgress extends UpdateProgressDto {
  lessonId: string;
  queuedAt: string;
}

export interface QueuedAttempt {
  quizId: string;
  lessonId: string;
  dto: SubmitAttemptDto;
  queuedAt: string;
}

type ProgressMap = Record<string, QueuedProgress>;

export function readProgressQueue(): ProgressMap {
  return getJson<ProgressMap>(KV_KEYS.progressQueue, {});
}

/** İki ilerleme kaydını birleştirir (saf fonksiyon — test edilir) */
export function mergeProgress(prev: QueuedProgress | undefined, next: QueuedProgress): QueuedProgress {
  if (!prev) return next;
  return {
    lessonId: next.lessonId,
    percent: Math.max(prev.percent, next.percent),
    lastBlockId: next.lastBlockId ?? prev.lastBlockId,
    secondsSpent: (prev.secondsSpent ?? 0) + (next.secondsSpent ?? 0),
    completed: Boolean(prev.completed || next.completed) || undefined,
    queuedAt: next.queuedAt,
  };
}

export function enqueueProgress(lessonId: string, dto: UpdateProgressDto): void {
  const queue = readProgressQueue();
  queue[lessonId] = mergeProgress(queue[lessonId], { ...dto, lessonId, queuedAt: new Date().toISOString() });
  setJson(KV_KEYS.progressQueue, queue);
}

export function pendingProgressCount(): number {
  return Object.keys(readProgressQueue()).length + readAttemptQueue().length;
}

/**
 * İlerlemeyi kaydeder: önce doğrudan gönderir; ağ hatasında kuyruğa alır.
 * @returns true → sunucuya ulaştı, false → kuyruğa alındı
 */
export async function saveProgress(lessonId: string, dto: UpdateProgressDto): Promise<boolean> {
  try {
    await endpoints.updateProgress(lessonId, dto);
    return true;
  } catch (e) {
    if (isApiError(e) && (e.isConnectivity || e.code === 'server' || e.code === 'rate_limited')) {
      enqueueProgress(lessonId, dto);
      return false;
    }
    throw e;
  }
}

let flushingProgress: Promise<number> | null = null;

/** Kuyruktaki ilerlemeleri gönderir; gönderilen kayıt sayısını döner */
export function flushProgressQueue(): Promise<number> {
  if (flushingProgress) return flushingProgress;
  flushingProgress = (async () => {
    let sent = 0;
    for (const item of Object.values(readProgressQueue())) {
      const { lessonId, queuedAt: _queuedAt, ...dto } = item;
      try {
        await endpoints.updateProgress(lessonId, dto);
        sent += 1;
        removeProgress(lessonId, item.queuedAt);
      } catch (e) {
        if (isApiError(e) && (e.isConnectivity || e.code === 'server' || e.code === 'unauthorized' || e.code === 'rate_limited')) break;
        // Kalıcı hata (ör. ders silindi) → kaydı at
        removeProgress(lessonId, item.queuedAt);
      }
    }
    return sent;
  })().finally(() => {
    flushingProgress = null;
  });
  return flushingProgress;
}

function removeProgress(lessonId: string, queuedAt: string): void {
  const queue = readProgressQueue();
  // Gönderim sırasında yeni kayıt eklendiyse silme
  if (queue[lessonId]?.queuedAt === queuedAt) {
    delete queue[lessonId];
    setJson(KV_KEYS.progressQueue, queue);
  }
}

/* ------------------------------ Quiz denemeleri ------------------------------ */

export function readAttemptQueue(): QueuedAttempt[] {
  return getJson<QueuedAttempt[]>(KV_KEYS.attemptQueue, []);
}

export function enqueueAttempt(quizId: string, lessonId: string, dto: SubmitAttemptDto): void {
  const queue = readAttemptQueue().filter((a) => a.quizId !== quizId);
  queue.push({ quizId, lessonId, dto, queuedAt: new Date().toISOString() });
  setJson(KV_KEYS.attemptQueue, queue);
}

export function queuedAttemptFor(quizId: string): QueuedAttempt | undefined {
  return readAttemptQueue().find((a) => a.quizId === quizId);
}

/** Bekleyen quiz denemelerini gönderir; sonuçları döner */
export async function flushAttemptQueue(): Promise<{ attempt: QueuedAttempt; result: AttemptResult }[]> {
  const out: { attempt: QueuedAttempt; result: AttemptResult }[] = [];
  for (const attempt of readAttemptQueue()) {
    try {
      const result = await endpoints.submitAttempt(attempt.quizId, attempt.dto);
      out.push({ attempt, result });
      setJson(KV_KEYS.attemptQueue, readAttemptQueue().filter((a) => a.queuedAt !== attempt.queuedAt));
    } catch (e) {
      // Geçici hatalarda (bağlantı, sunucu, oturum, hız sınırı) deneme kuyrukta kalır; kalıcı hatada düşürülür
      if (isApiError(e) && (e.isConnectivity || e.code === 'server' || e.code === 'unauthorized' || e.code === 'rate_limited')) break;
      setJson(KV_KEYS.attemptQueue, readAttemptQueue().filter((a) => a.queuedAt !== attempt.queuedAt));
    }
  }
  return out;
}

/** Son başarılı quiz sonuçları (kuyruktan gönderilenler) — Quiz bileşeni gösterir */
const ATTEMPT_RESULTS_KEY = 'queue.attemptResults';
export function storeAttemptResult(quizId: string, result: AttemptResult): void {
  const map = getJson<Record<string, AttemptResult>>(ATTEMPT_RESULTS_KEY, {});
  map[quizId] = result;
  setJson(ATTEMPT_RESULTS_KEY, map);
}
export function takeAttemptResult(quizId: string): AttemptResult | undefined {
  const map = getJson<Record<string, AttemptResult>>(ATTEMPT_RESULTS_KEY, {});
  const r = map[quizId];
  if (r) {
    delete map[quizId];
    setJson(ATTEMPT_RESULTS_KEY, map);
  }
  return r;
}

/** Çıkışta tüm yerel kuyrukları siler: bir kullanıcının bekleyen verisi sonraki hesaba gönderilmesin */
export function clearQueues(): void {
  kv.delete(KV_KEYS.progressQueue);
  kv.delete(KV_KEYS.attemptQueue);
  kv.delete(ATTEMPT_RESULTS_KEY);
}

/** Tüm kuyrukları boşaltır (çevrimiçi olunca / açılışta) */
export async function flushAllQueues(): Promise<void> {
  await flushProgressQueue();
  const results = await flushAttemptQueue();
  for (const { attempt, result } of results) storeAttemptResult(attempt.quizId, result);
}
