import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { LessonBlock } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';
import { Text } from '@/components/ui';
import { svgAspectRatio, themeSvg } from '@/utils/svgTheme';

type DiagramBlock = Extract<LessonBlock, { type: 'diagram' }>;

/**
 * Diyagram bloğu: block.svg (seed sırasında gömülen satır içi SVG) SvgXml ile çizilir.
 * CSS değişkenleri ve sınıf stilleri önce tema renklerine çevrilir (utils/svgTheme.ts).
 */
export function DiagramBlockView({ block }: { block: DiagramBlock }) {
  const { tl } = useI18n();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const xml = useMemo(() => (block.svg ? themeSvg(block.svg, colors) : null), [block.svg, colors]);
  const ratio = useMemo(() => (block.svg ? svgAspectRatio(block.svg) : 16 / 9), [block.svg]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View style={[styles.root, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={tl(block.alt)}>
        {xml && width > 0 ? (
          <SvgXml xml={xml} width={width} height={width / ratio} />
        ) : !xml ? (
          <Text muted variant="caption" style={{ padding: spacing.lg }}>
            {tl(block.alt)}
          </Text>
        ) : null}
      </View>
      {block.caption ? (
        <Text variant="caption" muted style={styles.caption}>
          {tl(block.caption)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', padding: spacing.sm },
  caption: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
});
