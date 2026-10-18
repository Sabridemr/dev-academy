import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Text } from './Text';

export type IconName = ComponentProps<typeof Ionicons>['name'];
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  right?: ReactNode;
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, compact, style, accessibilityLabel, accessibilityHint, testID, right }: ButtonProps) {
  const { colors } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.fg, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: withAlpha(colors.danger, 0.12), fg: colors.danger, border: withAlpha(colors.danger, 0.4) },
  };
  const p = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: p.bg, borderColor: p.border, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={p.fg} /> : icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={p.fg} /> : null}
      <Text variant="label" color={p.fg} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
  size?: number;
  testID?: string;
}

/** Yalnızca ikonlu buton — erişilebilirlik etiketi zorunlu */
export function IconButton({ icon, onPress, label, disabled, active, size = 20, testID }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.icon,
        { backgroundColor: active ? withAlpha(colors.primary, 0.14) : colors.elevated, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <View>
        <Ionicons name={icon} size={size} color={active ? colors.primary : colors.fg} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  compact: { minHeight: 36, paddingHorizontal: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
