import { forwardRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Text } from './Text';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, FieldProps>(function TextField(
  { label, error, style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...rest}
        style={[
          styles.input,
          {
            color: colors.fg,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

/** Yatay seçim kontrolü (dil, tema, algoritma ...) */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  wrap,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  wrap?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[
          styles.segments,
          { flexWrap: wrap ? 'wrap' : 'nowrap', backgroundColor: colors.elevated },
        ]}
      >
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={o.label}
              style={[
                styles.segment,
                wrap ? null : { flex: 1 },
                selected && { backgroundColor: colors.surface, borderColor: colors.primary },
              ]}
            >
              <Text
                variant="caption"
                weight={selected ? '700' : '500'}
                color={selected ? colors.primary : colors.fg}
                numberOfLines={1}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Chip({
  label,
  tone = 'default',
  icon,
}: {
  label: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const c = tone === 'default' ? colors.muted : colors[tone];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: withAlpha(c, 0.12), borderColor: withAlpha(c, 0.35) },
      ]}
    >
      {icon}
      <Text variant="caption" color={tone === 'default' ? colors.fg : c} weight="600">
        {label}
      </Text>
    </View>
  );
}

/** -/+ ile sayısal değer ayarlama (kaydırıcı yerine erişilebilir, bağımlılıksız) */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const { colors } = useTheme();
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  const display = format ? format(value) : String(value);
  return (
    <View
      style={styles.stepper}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: display }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))
      }
    >
      <Text variant="caption" style={{ flex: 1 }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} -`}
        onPress={() => onChange(clamp(value - step))}
        disabled={value <= min}
        style={[
          styles.stepBtn,
          { backgroundColor: colors.elevated, opacity: value <= min ? 0.4 : 1 },
        ]}
      >
        <Text weight="700">−</Text>
      </Pressable>
      <Text variant="label" style={{ minWidth: 48, textAlign: 'center' }}>
        {display}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} +`}
        onPress={() => onChange(clamp(value + step))}
        disabled={value >= max}
        style={[
          styles.stepBtn,
          { backgroundColor: colors.elevated, opacity: value >= max ? 0.4 : 1 },
        ]}
      >
        <Text weight="700">+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  segments: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  segment: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
