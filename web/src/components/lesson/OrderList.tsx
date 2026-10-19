'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import type { LocalizedString } from '@devacademy/shared';
import { useI18n } from '@/i18n';

/** Sıralama sorusu: seçenekler okla yer değiştirir. Quiz ve tekrar sayfası ortak kullanır. */
export function OrderList({
  order,
  options,
  onChange,
  disabled = false,
}: {
  order: string[];
  options: { id: string; text: LocalizedString }[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { t, tl } = useI18n();
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  return (
    <>
      <p className="mb-2 text-xs text-muted">{t('quiz.orderHint')}</p>
      <ul className="space-y-2">
        {order.map((oid, idx) => {
          const opt = options.find((o) => o.id === oid);
          const text = opt ? tl(opt.text) : oid;
          return (
            <li
              key={oid}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="w-5 text-muted">{idx + 1}</span>
              <span className="flex-1">{text}</span>
              <button
                type="button"
                className="btn-icon h-7 w-7"
                onClick={() => move(idx, -1)}
                disabled={idx === 0 || disabled}
                aria-label={t('quiz.moveUp', { item: text })}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="btn-icon h-7 w-7"
                onClick={() => move(idx, 1)}
                disabled={idx === order.length - 1 || disabled}
                aria-label={t('quiz.moveDown', { item: text })}
              >
                <ArrowDown size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
