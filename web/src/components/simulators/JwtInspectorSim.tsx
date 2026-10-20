'use client';

import { useI18n } from '@/i18n';
import { SimShell } from './ui';
import type { SimulatorProps } from './types';

/**
 * JWT inspector — GEÇİCİ İSKELET. Gerçek simülatör ayrı bir görevde yazılır; parametre anahtarları
 * ('secret', 'token') INTERACTIVE_PARAMS ile eşleşir.
 */
const PARAM_KEYS = ['secret', 'token'] as const;

export default function JwtInspectorSim({ params }: SimulatorProps) {
  const { locale } = useI18n();
  const given = PARAM_KEYS.filter((k) => params[k] !== undefined);
  return (
    <SimShell title={locale === 'tr' ? 'JWT inceleyici' : 'JWT inspector'}>
      <p className="text-sm text-muted">
        {locale === 'tr' ? 'Bu simülatör hazırlanıyor.' : 'This simulator is being built.'}
        {given.length > 0 && ` (${given.join(', ')})`}
      </p>
    </SimShell>
  );
}
