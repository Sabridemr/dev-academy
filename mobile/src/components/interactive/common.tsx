import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { InteractiveType } from '@devacademy/shared';
import { endpoints } from '@/lib/endpoints';
import { useSession } from '@/stores/session';
import { radius, spacing, useTheme } from '@/theme';
import { Text } from '@/components/ui';

/** Simülatör bileşenlerinin ortak prop'ları */
export interface SimProps {
  params: Record<string, unknown>;
  lessonId: string;
  /** İlk etkileşimde çağrılır (POST /progress/interactive — rozet için) */
  onInteract: () => void;
}

/** İlk kullanıcı etkileşiminde bir kez sunucuya oturum kaydı gönderir */
export function useInteractiveSession(type: InteractiveType, lessonId: string, params: Record<string, unknown>): () => void {
  const sent = useRef(false);
  const authed = useSession((s) => s.status === 'authenticated');
  return useCallback(() => {
    if (sent.current || !authed) return;
    sent.current = true;
    endpoints.recordInteractive({ interactive: type, lessonId, params }).catch(() => {
      // Rozet sayımı kritik değil; çevrimdışıysa sessizce geç
    });
  }, [authed, type, lessonId, params]);
}

/** setInterval'ı React yaşam döngüsüne bağlar; delay null ise durur */
export function useInterval(callback: () => void, delay: number | null): void {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function paramNumber(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function paramString<T extends string>(params: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T {
  const v = params[key];
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.elevated }]}>
      <Text variant="caption" muted numberOfLines={1}>
        {label}
      </Text>
      <Text variant="label" color={color}>
        {value}
      </Text>
    </View>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.statRow}>{children}</View>;
}

/** Simülatörlerde düğüm/sunucu renkleri */
export const SIM_PALETTE = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#0EA5E9', '#A855F7', '#EC4899', '#84CC16'];

const styles = StyleSheet.create({
  stat: { flexGrow: 1, flexBasis: '30%', borderRadius: radius.sm, padding: spacing.sm, gap: 2 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
