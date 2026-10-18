import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/i18n';
import { useOnline } from '@/lib/network';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { errorText } from '@/utils/errors';
import { Button, type IconName } from './Button';
import { Text } from './Text';

export function LoadingView({ label }: { label?: string }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View
      style={styles.center}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t('common.loading')}
    >
      <ActivityIndicator color={colors.primary} />
      <Text muted variant="caption">
        {label ?? t('common.loading')}
      </Text>
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
      <Text align="center">{errorText(error, t)}</Text>
      {onRetry ? (
        <Button
          title={t('common.retry')}
          variant="secondary"
          compact
          onPress={onRetry}
          icon="refresh"
        />
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = 'sparkles-outline', text }: { icon?: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={32} color={colors.muted} />
      <Text muted align="center">
        {text}
      </Text>
    </View>
  );
}

export function ProgressBar({
  value,
  color,
  height = 6,
  label,
}: {
  value: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: colors.elevated,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          backgroundColor: color ?? colors.primary,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

/** Çevrimdışı uyarı şeridi — yalnızca bağlantı yokken görünür */
export function OfflineBanner() {
  const online = useOnline();
  const { colors } = useTheme();
  const { t } = useI18n();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          backgroundColor: withAlpha(colors.warning, 0.18),
          borderColor: withAlpha(colors.warning, 0.5),
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.fg} />
      <Text variant="caption" style={{ flex: 1 }}>
        {t('offline.banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
