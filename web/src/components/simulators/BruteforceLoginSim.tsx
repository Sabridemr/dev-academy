'use client';

import { useI18n } from '@/i18n';
import { SimShell } from './ui';
import type { SimulatorProps } from './types';

/**
 * Brute force and lockout — GEÇİCİ İSKELET. Gerçek simülatör ayrı bir görevde yazılır; parametre anahtarları
 * ('attemptsPerSecond', 'lockoutAfter', 'lockoutSeconds', 'passwordSpace') INTERACTIVE_PARAMS ile eşleşir.
 */
const PARAM_KEYS = [
  'attemptsPerSecond',
  'lockoutAfter',
  'lockoutSeconds',
  'passwordSpace',
] as const;

export default function BruteforceLoginSim({ params }: SimulatorProps) {
  const { locale } = useI18n();
  const given = PARAM_KEYS.filter((k) => params[k] !== undefined);
  return (
    <SimShell title={locale === 'tr' ? 'Kaba kuvvet ve kilitleme' : 'Brute force and lockout'}>
      <p className="text-sm text-muted">
        {locale === 'tr' ? 'Bu simülatör hazırlanıyor.' : 'This simulator is being built.'}
        {given.length > 0 && ` (${given.join(', ')})`}
      </p>
    </SimShell>
  );
}
