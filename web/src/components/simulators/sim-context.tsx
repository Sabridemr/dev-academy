'use client';

import { createContext, useContext } from 'react';

/**
 * InteractiveBlock → SimShell köprüsü. Ders içeriğindeki başlık/yönerge ve "baştan kur"
 * (bileşeni yeniden kurma) işlevi, simülatörün kendi kabuğunda gösterilir; böylece blok
 * ve simülatör iki ayrı başlık basmaz.
 */
export interface SimContextValue {
  title?: string;
  goal?: string;
  onReset?: () => void;
}

export const SimContext = createContext<SimContextValue>({});

export function useSimContext(): SimContextValue {
  return useContext(SimContext);
}
