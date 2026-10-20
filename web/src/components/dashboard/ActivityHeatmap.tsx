'use client';

import { useMemo, useState } from 'react';
import type { DailyActivityDto } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

export interface HeatmapDay {
  /** YYYY-MM-DD */
  date: string;
  seconds: number;
  lessonsCompleted: number;
  quizzesPassed: number;
  xp: number;
  /** 0 (yok) … 4 (çok) */
  level: 0 | 1 | 2 | 3 | 4;
  /** Bugünden sonraki (henüz yaşanmamış) gün: boş hücre çizilir */
  future: boolean;
}

const DAY_MS = 86_400_000;

function keyToUtc(key: string): number {
  return Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
}

function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Tarayıcının yerel tarihine göre bugünün anahtarı */
export function localDateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Dakikaya göre yoğunluk: 0, <15, <30, <60, ≥60 dk (ders bitirmek en az 1. seviye sayılır) */
export function intensity(seconds: number, lessons = 0): HeatmapDay['level'] {
  const min = seconds / 60;
  if (min <= 0 && lessons <= 0) return 0;
  if (min < 15) return 1;
  if (min < 30) return 2;
  if (min < 60) return 3;
  return 4;
}

/**
 * Isı haritası ızgarası: sütunlar hafta (Pazartesi başlangıçlı), satırlar gün. Son sütun bugünün haftası.
 * Sunucunun döndürmediği günler sıfır aktiviteyle doldurulur.
 */
export function buildHeatmapWeeks(
  activity: DailyActivityDto[],
  todayKey: string,
  weeks = 52,
): HeatmapDay[][] {
  const byDate = new Map(activity.map((a) => [a.date, a]));
  const today = keyToUtc(todayKey);
  // getUTCDay: 0 = Pazar → Pazartesi tabanlı indeks
  const weekday = (new Date(today).getUTCDay() + 6) % 7;
  const start = today - (weekday + (weeks - 1) * 7) * DAY_MS;
  const columns: HeatmapDay[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    const col: HeatmapDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const ms = start + (w * 7 + d) * DAY_MS;
      const date = utcToKey(ms);
      const a = byDate.get(date);
      const seconds = a?.seconds ?? 0;
      const lessonsCompleted = a?.lessonsCompleted ?? 0;
      col.push({
        date,
        seconds,
        lessonsCompleted,
        quizzesPassed: a?.quizzesPassed ?? 0,
        xp: a?.xp ?? 0,
        level: intensity(seconds, lessonsCompleted),
        future: ms > today,
      });
    }
    columns.push(col);
  }
  return columns;
}

const LEVEL_CLASS: Record<HeatmapDay['level'], string> = {
  0: 'bg-elevated',
  1: 'bg-primary/25',
  2: 'bg-primary/45',
  3: 'bg-primary/70',
  4: 'bg-primary',
};

/** GitHub tarzı aktivite ısı haritası (son 52 hafta). Her hücre title + aria-label taşır. */
export function ActivityHeatmap({
  activity,
  todayKey,
  weeks = 52,
  className,
}: {
  activity: DailyActivityDto[];
  todayKey?: string;
  weeks?: number;
  className?: string;
}) {
  const { t, messages, locale } = useI18n();
  const today = todayKey ?? localDateKey();
  const columns = useMemo(
    () => buildHeatmapWeeks(activity, today, weeks),
    [activity, today, weeks],
  );
  const [hover, setHover] = useState<{ day: HeatmapDay; col: number; row: number } | null>(null);

  const loc = locale === 'tr' ? 'tr-TR' : 'en-US';
  const dateLabel = (key: string) =>
    new Date(keyToUtc(key)).toLocaleDateString(loc, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'short',
      timeZone: 'UTC',
    });
  const cellLabel = (d: HeatmapDay) => {
    const minutes = Math.round(d.seconds / 60);
    return minutes === 0 && d.lessonsCompleted === 0
      ? t('activity.none', { date: dateLabel(d.date) })
      : t('activity.cell', { date: dateLabel(d.date), minutes, lessons: d.lessonsCompleted });
  };

  const totals = useMemo(() => {
    let days = 0;
    let seconds = 0;
    for (const col of columns)
      for (const d of col) {
        if (d.level > 0) days += 1;
        seconds += d.seconds;
      }
    return { days, minutes: Math.round(seconds / 60) };
  }, [columns]);

  // Ay etiketleri: ayın ilk günü hangi sütundaysa o sütunun üstüne
  const months = useMemo(() => {
    const out: { col: number; label: string }[] = [];
    columns.forEach((col, i) => {
      const first = col.find((d) => d.date.endsWith('-01'));
      if (first && !first.future)
        out.push({
          col: i,
          label: new Date(keyToUtc(first.date)).toLocaleDateString(loc, {
            month: 'short',
            timeZone: 'UTC',
          }),
        });
    });
    return out;
  }, [columns, loc]);

  const CELL = 14; // px: hücre + boşluk (11px kare, 3px aralık)
  const weekdays = messages.activity.weekdays;

  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-3 text-xs text-muted">
        {t('activity.summary', { days: totals.days, minutes: totals.minutes })}
      </p>
      <div className="relative overflow-x-auto pb-2">
        <div className="inline-flex gap-2">
          {/* Gün adları */}
          <div className="mt-5 grid shrink-0 grid-rows-7 gap-[3px] text-xs leading-[11px] text-muted">
            {weekdays.map((w, i) => (
              <span key={i} className="h-[11px]" aria-hidden="true">
                {w}
              </span>
            ))}
          </div>
          <div className="relative">
            <div className="relative mb-1 h-4 text-xs text-muted" aria-hidden="true">
              {months.map((m) => (
                <span
                  key={`${m.col}-${m.label}`}
                  className="absolute top-0 whitespace-nowrap"
                  style={{ left: m.col * CELL }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            <div
              role="group"
              aria-label={t('activity.label')}
              className="flex gap-[3px]"
              onMouseLeave={() => setHover(null)}
            >
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((d, ri) =>
                    d.future ? (
                      <span key={d.date} className="h-[11px] w-[11px]" aria-hidden="true" />
                    ) : (
                      <span
                        key={d.date}
                        role="img"
                        aria-label={cellLabel(d)}
                        title={cellLabel(d)}
                        data-level={d.level}
                        data-date={d.date}
                        onMouseEnter={() => setHover({ day: d, col: ci, row: ri })}
                        className={cn(
                          'h-[11px] w-[11px] rounded-[3px] transition-colors',
                          LEVEL_CLASS[d.level],
                          d.date === today && 'ring-1 ring-fg/40',
                        )}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
            {hover && (
              <div
                className="card pointer-events-none absolute z-10 w-max -translate-x-1/2 px-3 py-2 text-xs shadow-pop"
                style={{
                  left: Math.min(Math.max(hover.col * CELL + 6, 80), columns.length * CELL - 80),
                  top: 20 + hover.row * CELL + 18,
                }}
                aria-hidden="true"
              >
                <p className="font-semibold">{dateLabel(hover.day.date)}</p>
                <p className="mt-0.5 text-muted">
                  {t('activity.minutes', { count: Math.round(hover.day.seconds / 60) })} ·{' '}
                  {t('activity.lessons', { count: hover.day.lessonsCompleted })} ·{' '}
                  {t('activity.quizzes', { count: hover.day.quizzesPassed })}
                  {hover.day.xp > 0 && <> · {t('activity.xp', { count: hover.day.xp })}</>}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className="mt-1 flex items-center justify-end gap-1.5 text-xs text-muted"
        aria-hidden="true"
      >
        <span>{t('activity.less')}</span>
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span key={l} className={cn('h-[11px] w-[11px] rounded-[3px]', LEVEL_CLASS[l])} />
        ))}
        <span>{t('activity.more')}</span>
      </div>
    </div>
  );
}
