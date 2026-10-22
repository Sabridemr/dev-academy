'use client';

import {
  BookOpen,
  CirclePlay,
  ExternalLink,
  FileText,
  FolderGit2,
  Library,
  Link2,
  Newspaper,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { LessonBlock, ResourceKind } from '@devacademy/shared';
import { useI18n } from '@/i18n';

type ResourcesBlockData = Extract<LessonBlock, { type: 'resources' }>;

const KIND_ICONS: Record<ResourceKind, LucideIcon> = {
  book: BookOpen,
  article: Newspaper,
  docs: FileText,
  video: CirclePlay,
  paper: ScrollText,
  repo: FolderGit2,
};

/** Ders sonu kaynakça: dış bağlantılar yeni sekmede, opener/referrer sızdırmadan açılır */
export function ResourcesBlock({ block }: { block: ResourcesBlockData }) {
  const { t } = useI18n();
  const titleId = `${block.id}-title`;
  return (
    <section className="card p-5" aria-labelledby={titleId} data-block="resources">
      <h2 id={titleId} className="mb-3 mt-0 flex items-center gap-2 text-base font-semibold">
        <Library size={18} className="text-accent" aria-hidden /> {t('lesson.resources.title')}
      </h2>
      <ul className="m-0 grid list-none gap-2 p-0">
        {block.items.map((item) => {
          const Icon = item.kind ? KIND_ICONS[item.kind] : Link2;
          const kindLabel = item.kind
            ? t(`lesson.resources.kind.${item.kind}` as 'lesson.resources.kind.book')
            : null;
          return (
            <li key={item.url} className="flex items-start gap-3">
              <Icon size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 break-words font-medium text-primary hover:underline"
                >
                  {item.title}
                  <ExternalLink size={12} aria-hidden />
                  <span className="sr-only">{t('lesson.resources.opensInNewTab')}</span>
                </a>
                {(kindLabel || item.note) && (
                  <p className="m-0 text-xs text-muted">
                    {[kindLabel, item.note].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
