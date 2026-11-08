import type { ConceptSummary, Locale } from '@devacademy/shared';
import { conceptDefinition, conceptTerms } from '@/components/glossary/concept-text';
import { shortDefinition } from '@/lib/term-text';

/**
 * GÜNDE 2 "GÜNÜN TERİMİ" BİLDİRİMİ — web (tarayıcı / kurulu PWA)
 * --------------------------------------------------------------
 * ÖNEMLİ SINIR: Sunucu tarafı Web Push olmadan tarayıcı, uygulama kapalıyken bildirim
 * zamanlayamaz. Bu yüzden bildirimler sayfa/PWA AÇIKKEN saatinde gösterilir; kapalıyken kaçan
 * son bir kaç saatlik slot, uygulama açılınca (CATCHUP_MS içinde ise) gösterilir.
 * Aynı gün + slot her zaman aynı terimi verir (mobil uygulamayla aynı algoritma).
 */

export const SETTINGS_KEY = 'da.termNotif';
export const SHOWN_KEY = 'da.termNotif.shown';
export const SETTINGS_EVENT = 'da:termnotif';
export const DEFAULT_HOURS: readonly [number, number] = [10, 19];
export const CATCHUP_MS = 4 * 3_600_000;
const DAY_MS = 86_400_000;

export interface TermNotifSettings {
  enabled: boolean;
  hours: [number, number];
}

export const DEFAULT_SETTINGS: TermNotifSettings = {
  enabled: false, // tarayıcı izni kullanıcı tıklamasıyla istenir; varsayılan kapalı
  hours: [DEFAULT_HOURS[0], DEFAULT_HOURS[1]],
};

const validHour = (h: unknown): h is number =>
  typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23;

export function readSettings(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): TermNotifSettings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const v = JSON.parse(raw) as Partial<TermNotifSettings>;
    const [a, b] = Array.isArray(v.hours) ? v.hours : [];
    return {
      enabled: v.enabled === true,
      hours: [validHour(a) ? a : DEFAULT_HOURS[0], validHour(b) ? b : DEFAULT_HOURS[1]],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(s: TermNotifSettings): void {
  try {
    safeStorage()?.setItem(SETTINGS_KEY, JSON.stringify(s));
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  } catch {
    // depolama kapalı (gizli mod vb.): ayar bu oturumla sınırlı kalır
  }
}

export function readLastShown(): number {
  try {
    return Number(safeStorage()?.getItem(SHOWN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function writeLastShown(ms: number): void {
  try {
    safeStorage()?.setItem(SHOWN_KEY, String(ms));
  } catch {
    // yok say
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Küçük, sabit tohumlu karıştırıcı (mulberry32) → tüm kavramlar tekrarsız dolaşılır */
export function seededOrder(length: number, seed: number): number[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx;
}

/** Verilen yerel gün + slot için deterministik terim (liste sırasından bağımsız) */
export function termForSlot(
  concepts: readonly ConceptSummary[],
  slotDate: Date,
  slot: number,
  slotsPerDay = 2,
): ConceptSummary | null {
  if (concepts.length === 0) return null;
  const sorted = [...concepts].sort((a, b) => a.id.localeCompare(b.id));
  const order = seededOrder(sorted.length, 20240611);
  const dayNumber = Math.floor(
    Date.UTC(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate()) / DAY_MS,
  );
  return sorted[order[(dayNumber * slotsPerDay + slot) % sorted.length]!]!;
}

export interface DueSlot {
  date: Date;
  slot: number;
}

/**
 * Gösterilmesi gereken slot: `now`'dan önceki en son slot; `lastShownMs`'ten yeni ve
 * `CATCHUP_MS` içinde olmalı. Yoksa null. (Bugünün ve dünün slotlarına bakılır.)
 */
export function dueSlot(
  now: Date,
  hours: readonly [number, number],
  lastShownMs: number,
): DueSlot | null {
  let best: DueSlot | null = null;
  for (const dayOffset of [-1, 0]) {
    hours.forEach((hour, slot) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0, 0, 0);
      const t = date.getTime();
      if (t > now.getTime() || now.getTime() - t > CATCHUP_MS || t <= lastShownMs) return;
      if (!best || t > best.date.getTime()) best = { date, slot };
    });
  }
  return best;
}

export interface TermNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export function termNotificationPayload(
  concept: ConceptSummary,
  locale: Locale,
): TermNotificationPayload {
  const { primary, secondary } = conceptTerms(concept.term, locale);
  return {
    title: secondary ? `📘 ${primary} (${secondary})` : `📘 ${primary}`,
    body: shortDefinition(conceptDefinition(concept.definition, locale), 160),
    url: `/glossary/${concept.id}`,
    tag: 'da-term',
  };
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Service worker varsa onun üzerinden (PWA/mobil), yoksa doğrudan Notification ile gösterir */
export async function showTermNotification(p: TermNotificationPayload): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const options: NotificationOptions = {
    body: p.body,
    tag: p.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: p.url },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(p.title, options);
      return;
    }
  } catch {
    // service worker yok → aşağıdaki yedek
  }
  const n = new Notification(p.title, options);
  n.onclick = () => {
    window.focus();
    window.location.assign(p.url);
    n.close();
  };
}
