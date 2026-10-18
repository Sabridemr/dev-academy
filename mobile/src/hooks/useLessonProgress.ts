import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LessonDetail } from '@devacademy/shared';
import { queryKeys } from '@/lib/queryClient';
import { saveProgress } from '@/offline/queue';
import { useSession } from '@/stores/session';

/**
 * DERS İLERLEME TAKİBİ
 * - Görüntülenen blok oranı → yüzde (scroll konumundan, LessonScreen bildirir)
 * - Harcanan süre (saniye)
 * - Sunucuya PUT /progress/lessons/:id — her %10'luk artışta, tamamlanınca ve ekrandan çıkarken;
 *   çevrimdışıysa MMKV kuyruğuna alınır (offline/queue.ts) ve bağlantı gelince gönderilir.
 */
export function useLessonProgress(lesson: LessonDetail | undefined) {
  const qc = useQueryClient();
  const authed = useSession((s) => s.status === 'authenticated');
  const viewed = useRef(new Set<string>());
  const lastBlockId = useRef<string | undefined>(undefined);
  const lastSentPercent = useRef(0);
  const sessionStart = useRef(Date.now());
  const completedRef = useRef(false);
  const [percent, setPercent] = useState(lesson?.progress?.percent ?? 0);
  const [completed, setCompleted] = useState(lesson?.progress?.status === 'completed');

  // Ders değişince sıfırla
  useEffect(() => {
    viewed.current = new Set();
    lastSentPercent.current = lesson?.progress?.percent ?? 0;
    sessionStart.current = Date.now();
    completedRef.current = lesson?.progress?.status === 'completed';
    setPercent(lesson?.progress?.percent ?? 0);
    setCompleted(lesson?.progress?.status === 'completed');
  }, [lesson?.id, lesson?.progress?.percent, lesson?.progress?.status]);

  const flush = useCallback(
    async (opts: { completed?: boolean; force?: boolean } = {}) => {
      if (!lesson || !authed) return;
      const total = Math.max(1, lesson.blocks.length);
      const pct = opts.completed ? 100 : Math.round((viewed.current.size / total) * 100);
      const seconds = Math.round((Date.now() - sessionStart.current) / 1000);
      if (!opts.force && !opts.completed && pct < lastSentPercent.current + 10 && pct < 100) return;
      lastSentPercent.current = Math.max(lastSentPercent.current, pct);
      sessionStart.current = Date.now();
      try {
        await saveProgress(lesson.id, {
          percent: Math.max(pct, lesson.progress?.percent ?? 0),
          lastBlockId: lastBlockId.current,
          secondsSpent: seconds,
          completed: opts.completed || completedRef.current || undefined,
        });
        void qc.invalidateQueries({ queryKey: queryKeys.summary });
      } catch {
        // Kalıcı sunucu hatası — ilerleme kaybı kritik değil
      }
    },
    [lesson, authed, qc],
  );

  /** LessonScreen: blok görünür olduğunda çağırır */
  const markViewed = useCallback(
    (blockId: string) => {
      if (!lesson || viewed.current.has(blockId)) return;
      viewed.current.add(blockId);
      lastBlockId.current = blockId;
      const pct = Math.round((viewed.current.size / Math.max(1, lesson.blocks.length)) * 100);
      setPercent((p) => Math.max(p, pct));
      void flush();
    },
    [lesson, flush],
  );

  const markCompleted = useCallback(async () => {
    completedRef.current = true;
    setCompleted(true);
    setPercent(100);
    await flush({ completed: true });
  }, [flush]);

  // Ekrandan çıkarken son durumu gönder
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current({ force: true }), []);

  return { percent, completed, markViewed, markCompleted };
}
