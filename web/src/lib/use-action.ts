'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Kullanıcı eylemi için async çalıştırıcı: aynı anda tek çalışma (çift tıklama kopya kayıt açmaz),
 * hata yutulmaz `error` olarak döner (arayüz gösterir), `pending` düğmeyi kilitler.
 */
export function useAction<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (...args: A) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await fnRef.current(...args);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);

  return { run, pending, error };
}
