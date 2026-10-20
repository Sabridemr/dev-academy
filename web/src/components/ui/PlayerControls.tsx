'use client';

import type { ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Animasyon oynatıcı ve kod simülasyonunun paylaştığı kontrol çubuğu:
 * [başa] [geri] [oynat/duraklat] [ileri] [sona] [çizelge … ] [sağ ekler]
 */
export function PlayerControls({
  playing,
  onTogglePlay,
  onPrev,
  onNext,
  onFirst,
  onLast,
  onRestart,
  canPrev,
  canNext,
  timeline,
  right,
  className,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  onRestart?: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** Ortadaki esnek alan: adım segmentleri ya da kaydırıcı */
  timeline?: ReactNode;
  /** Sağ taraf: hız, anlatım, tam ekran… */
  right?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 border-t border-border bg-surface px-2 py-2 sm:gap-2 sm:px-3',
        className,
      )}
    >
      {onFirst && (
        <button
          type="button"
          className="btn-icon btn-icon-sm hidden sm:inline-flex"
          onClick={onFirst}
          disabled={!canPrev}
          aria-label={t('trace.first')}
          title={t('trace.first')}
        >
          <ChevronsLeft size={16} />
        </button>
      )}
      <button
        type="button"
        className="btn-icon btn-icon-sm"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={t('player.stepBack')}
        title={t('player.stepBack')}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        className="btn-primary h-9 px-3"
        onClick={onTogglePlay}
        aria-label={playing ? t('player.pause') : t('player.play')}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
        <span className="hidden sm:inline">{playing ? t('player.pause') : t('player.play')}</span>
      </button>
      <button
        type="button"
        className="btn-icon btn-icon-sm"
        onClick={onNext}
        disabled={!canNext}
        aria-label={t('player.stepForward')}
        title={t('player.stepForward')}
      >
        <ChevronRight size={16} />
      </button>
      {onLast && (
        <button
          type="button"
          className="btn-icon btn-icon-sm hidden sm:inline-flex"
          onClick={onLast}
          disabled={!canNext}
          aria-label={t('trace.last')}
          title={t('trace.last')}
        >
          <ChevronsRight size={16} />
        </button>
      )}
      {onRestart && (
        <button
          type="button"
          className="btn-icon btn-icon-sm"
          onClick={onRestart}
          aria-label={t('player.restart')}
          title={t('player.restart')}
        >
          <RotateCcw size={15} />
        </button>
      )}
      {timeline && <div className="mx-1 flex min-w-[120px] flex-1 items-center">{timeline}</div>}
      {right && <div className="flex items-center gap-1.5">{right}</div>}
    </div>
  );
}
