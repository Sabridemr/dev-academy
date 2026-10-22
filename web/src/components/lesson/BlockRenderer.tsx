'use client';

import { Building2, Info, Lightbulb, AlertTriangle, OctagonAlert } from 'lucide-react';
import type { LessonBlock, LessonDetail } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Markdown } from './Markdown';
import { CodeBlock } from './CodeBlock';
import { Diagram } from './Diagram';
import { AnimationBlock } from './AnimationBlock';
import { InteractiveBlock } from './InteractiveBlock';
import { QuizBlock } from './QuizBlock';
import { TraceViewer } from './TraceViewer';
import { PredictBlock } from './PredictBlock';
import { ResourcesBlock } from './ResourcesBlock';

const CALLOUT_STYLES = {
  info: { icon: Info, cls: 'border-primary/40 bg-primary/5', iconCls: 'text-primary' },
  tip: { icon: Lightbulb, cls: 'border-success/40 bg-success/5', iconCls: 'text-success' },
  warning: { icon: AlertTriangle, cls: 'border-warning/50 bg-warning/5', iconCls: 'text-warning' },
  danger: { icon: OctagonAlert, cls: 'border-danger/50 bg-danger/5', iconCls: 'text-danger' },
} as const;

/** Tek bir ders bloğunu türüne göre çizer. Türler shared/content/schema.ts'deki LessonBlock birleşimidir. */
export function BlockRenderer({ block, lesson }: { block: LessonBlock; lesson: LessonDetail }) {
  const { t, tl, locale } = useI18n();
  const md = (tr: string, en?: string) => (locale === 'en' && en ? en : tr);

  switch (block.type) {
    case 'text':
      return <Markdown>{md(block.markdown, block.markdownEn)}</Markdown>;
    case 'diagram':
      return (
        <Diagram
          svg={block.svg}
          src={block.src}
          alt={block.alt}
          caption={block.caption}
          width={block.width}
          height={block.height}
        />
      );
    case 'animation':
      return <AnimationBlock sceneId={block.sceneId} caption={block.caption} />;
    case 'interactive':
      return (
        <InteractiveBlock
          type={block.interactive}
          params={block.params}
          title={block.title}
          instructions={block.instructions}
          lessonId={lesson.id}
        />
      );
    case 'code':
      return (
        <CodeBlock
          language={block.language}
          code={block.code}
          title={block.title}
          alternatives={block.alternatives}
          highlightLines={block.highlightLines}
        />
      );
    case 'realworld':
      return (
        <aside className="card border-l-4 border-l-accent p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-accent">
            <Building2 size={16} /> {t('lesson.realWorld', { company: block.company })}
          </p>
          <Markdown className="max-w-none [&>*:first-child]:mt-0">
            {md(block.markdown, block.markdownEn)}
          </Markdown>
        </aside>
      );
    case 'callout': {
      const style = CALLOUT_STYLES[block.tone];
      const Icon = style.icon;
      return (
        <aside className={cn('rounded-2xl border p-4', style.cls)} role="note">
          <p className={cn('mb-1 flex items-center gap-2 text-sm font-semibold', style.iconCls)}>
            <Icon size={16} />{' '}
            {block.title
              ? tl(block.title)
              : t(`lesson.calloutTone.${block.tone}` as 'lesson.calloutTone.info')}
          </p>
          <Markdown className="max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {md(block.markdown, block.markdownEn)}
          </Markdown>
        </aside>
      );
    }
    case 'quiz':
      return <QuizBlock lessonId={lesson.id} />;
    case 'trace':
      return block.trace ? (
        <TraceViewer trace={block.trace} title={block.title} caption={block.caption} />
      ) : null;
    case 'predict':
      return <PredictBlock block={block} />;
    case 'resources':
      return <ResourcesBlock block={block} />;
    case 'next':
      // Sıradaki ders, ders sonu kartında (LessonFinish) tek yerden gösterilir
      return null;
    default:
      return null;
  }
}
