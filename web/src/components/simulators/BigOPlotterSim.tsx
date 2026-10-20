'use client';

import { useI18n } from '@/i18n';
import { SimShell } from './ui';
import type { SimulatorProps } from './types';

/**
 * Big-O plotter — GEÇİCİ İSKELET. Gerçek simülatör ayrı bir görevde yazılır; parametre anahtarları
 * ('functions', 'maxN') INTERACTIVE_PARAMS ile eşleşir.
 */
const PARAM_KEYS = ['functions', 'maxN'] as const;

export default function BigOPlotterSim({ params }: SimulatorProps) {
  const { locale } = useI18n();
  const given = PARAM_KEYS.filter((k) => params[k] !== undefined);
  return (
    <SimShell title={locale === 'tr' ? 'Big-O çizici' : 'Big-O plotter'}>
      <p className="text-sm text-muted">
        {locale === 'tr' ? 'Bu simülatör hazırlanıyor.' : 'This simulator is being built.'}
        {given.length > 0 && ` (${given.join(', ')})`}
      </p>
    </SimShell>
  );
}
