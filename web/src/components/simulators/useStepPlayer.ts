'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks';

/**
 * Adım listesi üzerinde oynat / duraklat / ileri / geri imleci.
 * `cursor` 0 iken hiçbir adım uygulanmamıştır; `total` iken tüm adımlar uygulanmıştır.
 * Azaltılmış harekette "oynat" animasyon yerine doğrudan sona atlar.
 * `resetKey` değişince (yeni girdi / yeni işlem) imleç başa döner; öncesinde `autoplayNext()`
 * çağrıldıysa yeni adımlar kendiliğinden oynatılır.
 */
export function useStepPlayer(total: number, delayMs: number, resetKey: unknown) {
  const reduced = usePrefersReducedMotion();
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const autoplay = useRef(false);
  const finished = cursor >= total;

  useEffect(() => {
    const auto = autoplay.current;
    autoplay.current = false;
    setCursor(auto && reduced ? total : 0);
    setPlaying(auto && !reduced);
    // total ve reduced resetKey ile birlikte değişir; yalnızca anahtar değişiminde sıfırla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (!playing) return;
    if (finished) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setCursor((c) => Math.min(total, c + 1)), delayMs);
    return () => clearTimeout(id);
  }, [playing, finished, cursor, delayMs, total]);

  return {
    cursor,
    playing,
    finished,
    reduced,
    togglePlay() {
      if (finished) {
        setCursor(reduced ? total : 0);
        setPlaying(!reduced);
        return;
      }
      if (reduced) setCursor(total);
      else setPlaying((p) => !p);
    },
    next() {
      setPlaying(false);
      setCursor((c) => Math.min(total, c + 1));
    },
    prev() {
      setPlaying(false);
      setCursor((c) => Math.max(0, c - 1));
    },
    reset() {
      setPlaying(false);
      setCursor(0);
    },
    /** Bir sonraki resetKey değişiminde adımları kendiliğinden oynat */
    autoplayNext() {
      autoplay.current = true;
    },
    end() {
      setPlaying(false);
      setCursor(total);
    },
  };
}
