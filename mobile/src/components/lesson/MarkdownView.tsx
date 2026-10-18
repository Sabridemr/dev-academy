import { memo, useMemo } from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { radius, useTheme, withAlpha } from '@/theme';

/**
 * Ders Markdown'ı (react-native-markdown-display) — tema renkleriyle.
 * Bağlantılar sistem tarayıcısında açılır.
 */
export const MarkdownView = memo(function MarkdownView({ children, compact }: { children: string; compact?: boolean }) {
  const { colors } = useTheme();
  const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
  const style = useMemo(
    () =>
      StyleSheet.create({
        body: { color: colors.fg, fontSize: compact ? 14 : 16, lineHeight: compact ? 21 : 25 },
        heading1: { color: colors.fg, fontSize: 24, fontWeight: '800', marginTop: 12, marginBottom: 6 },
        heading2: { color: colors.fg, fontSize: 20, fontWeight: '700', marginTop: 12, marginBottom: 6 },
        heading3: { color: colors.fg, fontSize: 17, fontWeight: '700', marginTop: 10, marginBottom: 4 },
        paragraph: { marginTop: compact ? 0 : 4, marginBottom: compact ? 2 : 8 },
        strong: { fontWeight: '700' },
        link: { color: colors.primary, textDecorationLine: 'underline' },
        blockquote: { backgroundColor: colors.elevated, borderLeftColor: colors.primary, borderLeftWidth: 3, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 6 },
        code_inline: { fontFamily: mono, backgroundColor: withAlpha(colors.primary, 0.1), color: colors.fg, borderRadius: 4, paddingHorizontal: 4 },
        code_block: { fontFamily: mono, backgroundColor: colors.elevated, color: colors.fg, borderRadius: radius.sm, padding: 10, fontSize: 13 },
        fence: { fontFamily: mono, backgroundColor: colors.elevated, color: colors.fg, borderRadius: radius.sm, padding: 10, fontSize: 13, borderColor: colors.border },
        table: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.sm },
        th: { padding: 6, borderColor: colors.border },
        td: { padding: 6, borderColor: colors.border },
        tr: { borderBottomColor: colors.border },
        hr: { backgroundColor: colors.border, height: 1, marginVertical: 10 },
        bullet_list_icon: { color: colors.primary },
        ordered_list_icon: { color: colors.primary },
      }),
    [colors, compact, mono],
  );
  return (
    <Markdown
      style={style}
      onLinkPress={(url) => {
        void Linking.openURL(url);
        return false;
      }}
    >
      {children}
    </Markdown>
  );
});
