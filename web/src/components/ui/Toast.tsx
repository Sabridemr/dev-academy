'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger' | 'badge';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms; 0 = elle kapatılana kadar */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  info: { Icon: Info, cls: 'text-primary' },
  success: { Icon: CheckCircle2, cls: 'text-success-fg' },
  warning: { Icon: TriangleAlert, cls: 'text-warning-fg' },
  danger: { Icon: XCircle, cls: 'text-danger-fg' },
  badge: { Icon: Award, cls: 'text-warning-fg' },
} as const;

/** Sağ altta yığılan kısa bildirimler. `useToast().toast({...})` ile kullanılır. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-4), { ...input, id }]);
      const duration = input.duration ?? 4500;
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const { Icon, cls } = ICONS[item.tone ?? 'info'];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                role="status"
                className="card pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3 pr-2 shadow-pop"
              >
                <Icon size={18} className={cn('mt-0.5 shrink-0', cls)} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{item.title}</p>
                  {item.description && <p className="mt-0.5 text-muted">{item.description}</p>}
                  {item.action && (
                    <button
                      type="button"
                      className="btn-link mt-1"
                      onClick={() => {
                        item.action?.onClick();
                        dismiss(item.id);
                      }}
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-icon btn-icon-sm border-0 bg-transparent"
                  onClick={() => dismiss(item.id)}
                  aria-label="×"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast yalnızca ToastProvider içinde kullanılabilir');
  return ctx;
}

/** Provider dışında (test vb.) sessizce çalışan sürüm */
export function useOptionalToast(): ToastContextValue {
  return useContext(ToastContext) ?? { toast: () => 0, dismiss: () => undefined };
}
