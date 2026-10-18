import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { LessonBlock } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { MONO_FONT, SegmentedControl, Text } from '@/components/ui';
import { tokenize, type TokenKind } from '@/utils/highlight';

type CodeBlock = Extract<LessonBlock, { type: 'code' }>;

/** Kod bloğu: yatay kaydırılabilir eş aralıklı görünüm, basit vurgulama, alternatif dil sekmeleri */
export function CodeBlockView({ block }: { block: CodeBlock }) {
  const { t, tl } = useI18n();
  const { colors, scheme } = useTheme();
  const variants = useMemo(
    () => [{ language: block.language, code: block.code, title: block.title }, ...block.alternatives],
    [block],
  );
  const [index, setIndex] = useState(0);
  const current = variants[Math.min(index, variants.length - 1)];
  const lines = useMemo(() => tokenize(current.code, current.language), [current]);
  const highlight = new Set(index === 0 ? block.highlightLines : []);

  const tokenColor: Record<TokenKind, string> = {
    plain: colors.fg,
    keyword: colors.primary,
    string: scheme === 'dark' ? '#86EFAC' : '#047857',
    number: colors.accent,
    comment: colors.muted,
    type: scheme === 'dark' ? '#F0ABFC' : '#A21CAF',
  };

  return (
    <View style={[styles.root, { borderColor: colors.border, backgroundColor: colors.elevated }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="caption" weight="600" style={{ flex: 1 }} numberOfLines={1}>
          {current.title ? tl(current.title) : current.language}
        </Text>
      </View>
      {variants.length > 1 ? (
        <View style={styles.tabs}>
          <SegmentedControl
            label={t('lesson.codeAlternatives')}
            wrap
            value={index}
            onChange={setIndex}
            options={variants.map((v, i) => ({ value: i, label: v.language }))}
          />
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.code} accessibilityLabel={current.code}>
        <View>
          {lines.map((tokens, li) => (
            <View key={li} style={[styles.line, highlight.has(li + 1) && { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
              <Text variant="mono" color={colors.muted} style={styles.lineNo}>
                {String(li + 1).padStart(2, ' ')}
              </Text>
              <Text variant="mono" selectable>
                {tokens.length === 0 ? ' ' : tokens.map((tok, ti) => (
                  <Text key={ti} variant="mono" color={tokenColor[tok.kind]} style={tok.kind === 'comment' ? { fontStyle: 'italic' } : undefined}>
                    {tok.text}
                  </Text>
                ))}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  tabs: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  code: { padding: spacing.md },
  line: { flexDirection: 'row', paddingRight: spacing.md },
  lineNo: { width: 28, fontFamily: MONO_FONT, opacity: 0.7 },
});
