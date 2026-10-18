'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Award } from 'lucide-react';
import type { BadgeDto, WsServerEvent } from '@devacademy/shared';
import { API_URL } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useI18n } from '@/i18n';

/**
 * WebSocket köprüsü: sunucu olaylarını React Query cache'ine yansıtır ve rozet bildirimlerini gösterir.
 * socket.io-client yalnızca tarayıcıda, dinamik import ile yüklenir.
 */
export function RealtimeBridge() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const { tl } = useI18n();
  const [toasts, setToasts] = useState<BadgeDto[]>([]);

  useEffect(() => {
    let socket: { disconnect: () => void } | null = null;
    let cancelled = false;
    void import('socket.io-client').then(({ io }) => {
      if (cancelled) return;
      const origin = new URL(API_URL).origin;
      const s = io(origin, {
        path: '/ws',
        auth: token ? { token } : {},
        transports: ['websocket'],
        reconnectionAttempts: 5,
      });
      s.on('event', (ev: WsServerEvent) => {
        switch (ev.type) {
          case 'progress.updated':
            void qc.invalidateQueries({ queryKey: ['progress-summary'] });
            break;
          case 'streak.updated':
            void qc.invalidateQueries({ queryKey: ['progress-summary'] });
            break;
          case 'badge.earned':
            setToasts((t) => [...t, ev.payload]);
            setTimeout(() => setToasts((t) => t.filter((x) => x.id !== ev.payload.id)), 5000);
            break;
          case 'content.published':
            void qc.invalidateQueries({ queryKey: ['lesson', ev.payload.lessonId] });
            void qc.invalidateQueries({ queryKey: ['module'] });
            break;
          default:
            break;
        }
      });
      socket = s;
    });
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [token, qc]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((b) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card pointer-events-auto flex items-center gap-3 px-4 py-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-accent">
              <Award size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold">{tl(b.title)}</p>
              <p className="text-xs text-muted">{tl(b.description)}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
