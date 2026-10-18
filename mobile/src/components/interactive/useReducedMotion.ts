import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Sistem "hareketi azalt" tercihi (simülatör animasyonlarını atlamak için) */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        if (alive) setReduced(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(v));
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}
