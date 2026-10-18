'use client';

import { useMemo, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { Maximize2, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { LocalizedString } from '@devacademy/shared';

/**
 * İçerik SVG'lerini güvenli biçimde gösterir. DOMPurify (SVG profili) script, olay işleyicileri,
 * foreignObject ve tüm bağlantı/dış referansları temizler; animate/set ile öznitelik değiştirme de yasaktır.
 * İçerik SVG'leri href/use kullanmadığı için bunlar tamamen kapalıdır. Sunucuda (SSR) da çalışır.
 * SVG'ler --da-* CSS değişkenlerini kullandığı için tema otomatik uygulanır.
 */
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'animate', 'animateMotion', 'animateTransform', 'set', 'use', 'image', 'a'],
    FORBID_ATTR: ['href', 'xlink:href'],
  });
}

export function Diagram({ svg, src, alt, caption }: { svg?: string; src: string; alt: LocalizedString; caption?: LocalizedString }) {
  const { tl, t } = useI18n();
  const [zoom, setZoom] = useState(false);
  const clean = useMemo(() => (svg ? sanitizeSvg(svg) : null), [svg]);
  const altText = tl(alt);

  const content = clean ? (
    <div className="diagram-svg" role="img" aria-label={altText} dangerouslySetInnerHTML={{ __html: clean }} suppressHydrationWarning />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={altText} className="mx-auto h-auto w-full" />
  );

  return (
    <figure className="card overflow-hidden">
      <div className="relative bg-bg/50 p-4">
        {content}
        <button type="button" className="btn-icon absolute right-3 top-3" onClick={() => setZoom(true)} aria-label={altText}>
          <Maximize2 size={15} />
        </button>
      </div>
      {caption && <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">{tl(caption)}</figcaption>}
      {zoom && (
        <div role="dialog" aria-modal="true" aria-label={altText} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setZoom(false)}>
          <div className="relative max-h-full w-full max-w-6xl overflow-auto rounded-2xl bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn-icon absolute right-3 top-3" onClick={() => setZoom(false)} aria-label={t('common.close')}>
              <X size={16} />
            </button>
            {content}
          </div>
        </div>
      )}
    </figure>
  );
}
