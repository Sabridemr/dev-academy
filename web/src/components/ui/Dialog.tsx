'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Erişilebilir diyalog: body'ye portal, odak tuzağı (Tab/Shift+Tab döner), Esc ile kapanma,
 * arka plana tıklayınca kapanma, kapanınca odağı açan öğeye geri verme, kaydırma kilidi.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className,
  hideClose = false,
  /** Üst şeridi gizle (örn. komut paleti kendi girişini çizer) */
  bare = false,
  /** Başlık görünmesin ama ekran okuyucuya verilsin */
  srTitle,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  hideClose?: boolean;
  bare?: boolean;
  srTitle?: string;
}) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Odağı yönet: açılınca panele, kapanınca önceki öğeye
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first =
      node?.querySelector<HTMLElement>('[data-autofocus]') ??
      node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const width = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-6xl',
    full: 'max-w-[96vw]',
  }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title || srTitle ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'card relative my-auto w-full animate-fade-up shadow-pop outline-none',
          width,
          className,
        )}
      >
        {srTitle && !title && (
          <h2 id={titleId} className="sr-only">
            {srTitle}
          </h2>
        )}
        {!bare && (title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="t-h3 truncate">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-0.5 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && (
              <button
                type="button"
                className="btn-icon btn-icon-sm"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        {bare && !hideClose && (
          <button
            type="button"
            className="btn-icon btn-icon-sm absolute right-3 top-3 z-10"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        )}
        <div className={cn(!bare && 'p-5')}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
