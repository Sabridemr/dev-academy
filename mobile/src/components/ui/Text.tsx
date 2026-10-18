import { Platform, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fontSize, useTheme } from '@/theme';

/** Tipografi varyantları — tüm metinler tema rengini otomatik alır */
export type TextVariant =
  'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label' | 'mono';

interface Props extends TextProps {
  variant?: TextVariant;
  muted?: boolean;
  color?: string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

export const MONO_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

const VARIANTS: Record<TextVariant, TextStyle> = {
  title: { fontSize: fontSize.xxl, fontWeight: '800', lineHeight: 34 },
  heading: { fontSize: fontSize.xl, fontWeight: '700', lineHeight: 28 },
  subheading: { fontSize: fontSize.lg, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: fontSize.md, lineHeight: 24 },
  caption: { fontSize: fontSize.xs, lineHeight: 16 },
  label: { fontSize: fontSize.sm, fontWeight: '600', lineHeight: 20 },
  mono: { fontSize: 13, lineHeight: 20, fontFamily: MONO_FONT },
};

export function Text({ variant = 'body', muted, color, weight, align, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        VARIANTS[variant],
        { color: color ?? (muted ? colors.muted : colors.fg) },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
