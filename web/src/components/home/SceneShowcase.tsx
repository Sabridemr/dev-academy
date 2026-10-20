'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { parseScene, type AnimationScene, type LocalizedString } from '@devacademy/shared';
import exampleScene from '@devacademy/shared/examples/load-balancer-round-robin.scene.json';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { ScenePlayer } from '../scene/ScenePlayer';

export interface ShowcaseScene {
  scene: AnimationScene;
  lessonId: string;
  label: LocalizedString;
}

/** API'ye ulaşılamazsa (ör. derleme anında) paketlenmiş örnek sahne gösterilir */
const FALLBACK: ShowcaseScene[] = [
  { scene: parseScene(exampleScene), lessonId: 'a-05-load-balancing', label: 'Load Balancer' },
];

/** Ana sayfa vitrini: farklı modüllerden animasyonlar, sekmeyle seçilir; altta ilgili derse bağlantı */
export function SceneShowcase({
  scenes,
  autoPlay = false,
}: {
  scenes: ShowcaseScene[];
  /** Vitrinde otomatik ve döngülü oynat */
  autoPlay?: boolean;
}) {
  const { t, tl } = useI18n();
  const items = scenes.length ? scenes : FALLBACK;
  const [index, setIndex] = useState(0);
  const current = items[Math.min(index, items.length - 1)];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    setIndex(next);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="min-w-0">
      {items.length > 1 && (
        <div
          role="tablist"
          aria-label={t('home.showcaseLabel')}
          className="mb-3 flex gap-2 overflow-x-auto pb-1"
          onKeyDown={onKeyDown}
        >
          {items.map((s, i) => (
            <button
              key={s.scene.id}
              type="button"
              role="tab"
              id={`showcase-tab-${s.scene.id}`}
              aria-selected={i === index}
              aria-controls="showcase-panel"
              tabIndex={i === index ? 0 : -1}
              onClick={() => setIndex(i)}
              className={cn(
                'chip shrink-0 whitespace-nowrap transition',
                i === index ? 'chip-primary' : 'hover:bg-elevated',
              )}
            >
              {tl(s.label)}
            </button>
          ))}
        </div>
      )}
      <div id="showcase-panel" role="tabpanel" aria-labelledby={`showcase-tab-${current.scene.id}`}>
        {/* key: sekme değişince oynatıcı durumu sıfırlanır */}
        <ScenePlayer
          key={current.scene.id}
          scene={current.scene}
          autoPlay={autoPlay}
          loop={autoPlay}
          className="shadow-pop"
        />
        <Link href={`/lessons/${current.lessonId}`} className="btn-link mt-3">
          {t('home.goToLesson')} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
