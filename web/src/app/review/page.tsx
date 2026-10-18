'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useReviews } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/**
 * Aralıklı tekrar: yanlış cevaplanan sorular SM-2 takvimine göre geri gelir.
 * Kullanıcı soruyu düşünür, seçim yapar, ardından ne kadar iyi hatırladığını 0-5 arası değerlendirir.
 * (Doğru cevap ilgili derste açıklamasıyla görülebilir.)
 */
function Review() {
  const { t, tl, messages } = useI18n();
  const qc = useQueryClient();
  const { data: cards, isLoading } = useReviews();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  if (isLoading) return <div className="card h-48 animate-pulse" />;
  const card = cards?.[index];
  if (!card) return <div className="card p-8 text-center text-muted">{t('review.empty')}</div>;

  const grade = async (quality: number) => {
    await api(`/progress/reviews/${card.id}/grade`, { method: 'POST', body: { quality } });
    setSelected([]);
    setRevealed(false);
    if (index + 1 >= (cards?.length ?? 0)) {
      await qc.invalidateQueries({ queryKey: ['reviews'] });
      await qc.invalidateQueries({ queryKey: ['progress-summary'] });
      setIndex(0);
    } else setIndex(index + 1);
  };

  return (
    <div className="card p-6">
      <div className="mb-3 flex justify-between text-xs text-muted">
        <span className="chip">{t('review.concept', { name: card.concept })}</span>
        <span>{index + 1}/{cards?.length}</span>
      </div>
      <p className="mb-4 text-lg font-medium">{tl(card.prompt)}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {card.options.map((o) => (
          <button key={o.id} type="button" disabled={revealed} onClick={() => setSelected((s) => (card.type === 'multiple' ? (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]) : [o.id]))} className={cn('rounded-lg border px-3 py-2 text-left text-sm', selected.includes(o.id) ? 'border-primary bg-primary/10' : 'border-border hover:bg-elevated')}>
            {tl(o.text)}
          </button>
        ))}
      </div>
      {!revealed ? (
        <button type="button" className="btn-primary mt-5" disabled={selected.length === 0} onClick={() => setRevealed(true)}>
          {t('review.reveal')}
        </button>
      ) : (
        <div className="mt-5">
          <p className="mb-2 text-sm text-muted">
            {t('review.howWell')}{' '}
            <Link href={`/lessons/${card.lessonId}`} className="text-primary underline">
              {t('lesson.nextStep')}
            </Link>
          </p>
          <div className="flex flex-wrap gap-2">
            {messages.review.grades.map((label, q) => (
              <button key={label} type="button" className={cn('btn-ghost', q < 3 ? 'hover:border-danger' : 'hover:border-success')} onClick={() => grade(q)}>
                {q} · {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const { t } = useI18n();
  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-3xl font-bold">{t('review.title')}</h1>
        <Review />
      </div>
    </RequireAuth>
  );
}
