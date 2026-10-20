'use client';

import { useI18n } from '@/i18n';
import { SimShell } from './ui';
import type { SimulatorProps } from './types';

/**
 * OAuth flow — GEÇİCİ İSKELET. Gerçek simülatör ayrı bir görevde yazılır; parametre anahtarları
 * ('flow', 'pkce') INTERACTIVE_PARAMS ile eşleşir.
 */
const PARAM_KEYS = ['flow', 'pkce'] as const;

export default function OAuthFlowSim({ params }: SimulatorProps) {
  const { locale } = useI18n();
  const given = PARAM_KEYS.filter((k) => params[k] !== undefined);
  return (
    <SimShell title={locale === 'tr' ? 'OAuth akışı' : 'OAuth flow'}>
      <p className="text-sm text-muted">
        {locale === 'tr' ? 'Bu simülatör hazırlanıyor.' : 'This simulator is being built.'}
        {given.length > 0 && ` (${given.join(', ')})`}
      </p>
    </SimShell>
  );
}
