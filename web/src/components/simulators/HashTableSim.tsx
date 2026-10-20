'use client';

import { useI18n } from '@/i18n';
import { SimShell } from './ui';
import type { SimulatorProps } from './types';

/**
 * Hash table — GEÇİCİ İSKELET. Gerçek simülatör ayrı bir görevde yazılır; parametre anahtarları
 * ('buckets', 'collision', 'loadFactor') INTERACTIVE_PARAMS ile eşleşir.
 */
const PARAM_KEYS = ['buckets', 'collision', 'loadFactor'] as const;

export default function HashTableSim({ params }: SimulatorProps) {
  const { locale } = useI18n();
  const given = PARAM_KEYS.filter((k) => params[k] !== undefined);
  return (
    <SimShell title={locale === 'tr' ? 'Hash tablosu' : 'Hash table'}>
      <p className="text-sm text-muted">
        {locale === 'tr' ? 'Bu simülatör hazırlanıyor.' : 'This simulator is being built.'}
        {given.length > 0 && ` (${given.join(', ')})`}
      </p>
    </SimShell>
  );
}
