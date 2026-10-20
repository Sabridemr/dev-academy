'use client';

import { useMemo, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { Maximize2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { resolveAssetUrl, type LocalizedString } from '@devacademy/shared';
import { API_URL } from '@/lib/api';
import { Dialog } from '../ui/Dialog';

/**
 * İçerik SVG'lerini güvenli biçimde gösterir. DOMPurify (SVG profili) script, olay işleyicileri,
 * foreignObject ve tüm bağlantı/dış referansları temizler; animate/set ile öznitelik değiştirme de yasaktır.
 * <style> de yasaktır: satır içi SVG'de stil kuralları tüm sayfaya uygulanır (stiller öznitelik olarak yazılmalı).
 * İçerik SVG'leri href/use kullanmadığı için bunlar tamamen kapalıdır. Sunucuda (SSR) da çalışır.
 * SVG'ler --da-* CSS değişkenlerini kullandığı için tema otomatik uygulanır.
 */
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      'script',
      'style',
      'foreignObject',
      'animate',
      'animateMotion',
      'animateTransform',
      'set',
      'use',
      'image',
      'a',
    ],
    FORBID_ATTR: ['href', 'xlink:href'],
  });
}

export function Diagram({
  svg,
  src,
  alt,
  caption,
  width,
  height,
}: {
  svg?: string;
  src: string;
  alt: LocalizedString;
  caption?: LocalizedString;
  /** Raster görselin piksel boyutu: yer önceden ayrılır, sayfa yüklenirken kaymaz */
  width?: number;
  height?: number;
}) {
  const { tl, t } = useI18n();
  const [zoom, setZoom] = useState(false);
  const clean = useMemo(() => (svg ? sanitizeSvg(svg) : null), [svg]);
  const altText = tl(alt);

  const content = clean ? (
    <div
      className="diagram-svg"
      role="img"
      aria-label={altText}
      dangerouslySetInnerHTML={{ __html: clean }}
      suppressHydrationWarning
    />
  ) : (
    // Ders görselleri API'den orijinal çözünürlükte gelir (yeniden sıkıştırılmaz)
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveAssetUrl(src, API_URL)}
      alt={altText}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className="mx-auto h-auto w-full"
    />
  );

  return (
    <figure className="card overflow-hidden">
      <div className="relative bg-bg/50 p-4">
        {content}
        <button
          type="button"
          className="btn-icon btn-icon-sm absolute right-3 top-3"
          onClick={() => setZoom(true)}
          aria-label={t('common.zoom')}
          title={t('common.zoom')}
        >
          <Maximize2 size={15} />
        </button>
      </div>
      {caption && (
        <figcaption className="border-t border-border px-4 py-2 text-xs text-muted">
          {tl(caption)}
        </figcaption>
      )}
      <Dialog open={zoom} onClose={() => setZoom(false)} size="xl" srTitle={altText} bare>
        <div className="max-h-[85vh] overflow-auto p-6 [&_.diagram-svg_svg]:max-h-none">
          {content}
        </div>
      </Dialog>
    </figure>
  );
}
