'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import type { ExamDto, ExamResult } from '@devacademy/shared';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ExamResultView } from '@/components/exam/ExamResultView';
import { ExamRunner } from '@/components/exam/ExamRunner';
import { ExamSetup } from '@/components/exam/ExamSetup';
import type { ExamAnswers } from '@/components/exam/exam.logic';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/i18n';
import { useExam } from '@/lib/hooks';

/**
 * Mülakat modu: kurulum → sınav → sonuç. Sınav kimliği URL'de (?id=) tutulur; sayfa yenilenirse
 * GET /exams/:id ile sorular, sessionStorage'dan cevaplar geri yüklenir.
 */
function ExamFlow() {
  const { t } = useI18n();
  const router = useRouter();
  const id = useSearchParams().get('id');
  const [created, setCreated] = useState<ExamDto | null>(null);
  const [finished, setFinished] = useState<{
    exam: ExamDto | null;
    result: ExamResult;
    answers: ExamAnswers;
  } | null>(null);
  const resumed = useExam(!finished && !created && id ? id : null);
  const exam = created ?? resumed.data ?? null;

  if (finished)
    return (
      <ExamResultView
        exam={finished.exam}
        result={finished.result}
        answers={finished.answers}
        onNew={() => {
          setFinished(null);
          setCreated(null);
        }}
      />
    );

  if (exam)
    return (
      <ExamRunner
        key={exam.id}
        exam={exam}
        onDone={(result, answers) => {
          setFinished({ exam, result, answers });
          setCreated(null);
          router.replace('/exam');
        }}
      />
    );

  if (id && resumed.isLoading)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  if (id && resumed.isError)
    return (
      <EmptyState
        className="card"
        icon={SearchX}
        title={t('exam.notFound')}
        description={t('exam.notFoundHint')}
        action={
          <Link href="/exam" className="btn-primary">
            {t('exam.newExam')}
          </Link>
        }
      />
    );

  return (
    <ExamSetup
      onCreated={(e) => {
        setCreated(e);
        router.replace(`/exam?id=${encodeURIComponent(e.id)}`);
      }}
    />
  );
}

export default function ExamPage() {
  const { t } = useI18n();
  return (
    <RequireAuth>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="t-h1">{t('exam.title')}</h1>
          <p className="mt-1 text-muted">{t('exam.subtitle')}</p>
        </div>
        <Suspense>
          <ExamFlow />
        </Suspense>
      </div>
    </RequireAuth>
  );
}
