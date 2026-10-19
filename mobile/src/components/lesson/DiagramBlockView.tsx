import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { resolveAssetUrl, type LessonBlock } from '@devacademy/shared';
import { env } from '@/config/env';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';
import { Text } from '@/components/ui';
import { svgAspectRatio, themeSvg } from '@/utils/svgTheme';

type DiagramBlock = Extract<LessonBlock, { type: 'diagram' }>;

/**
 * Diyagram bloğu: block.svg (seed sırasında gömülen satır içi SVG) SvgXml ile çizilir.
 * CSS değişkenleri ve sınıf stilleri önce tema renklerine çevrilir (utils/svgTheme.ts).
 * Raster görseller (PDF'ten gelen sayfalar, ekran görüntüleri) API'den orijinal çözünürlükte yüklenir;
 * dokununca tam boyutta (yakınlaştırılabilir) açılır.
 */
export function DiagramBlockView({ block }: { block: DiagramBlock }) {
  const { tl } = useI18n();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const xml = useMemo(() => (block.svg ? themeSvg(block.svg, colors) : null), [block.svg, colors]);
  const ratio = useMemo(() => (block.svg ? svgAspectRatio(block.svg) : 16 / 9), [block.svg]);
  const imageUri = !block.svg && block.src ? resolveAssetUrl(block.src, env.apiUrl) : null;
  const imageRatio = block.width && block.height ? block.width / block.height : 4 / 3;

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View style={[styles.root, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={tl(block.alt)}
      >
        {xml && width > 0 ? (
          <SvgXml xml={xml} width={width} height={width / ratio} />
        ) : imageUri && width > 0 ? (
          <Pressable
            onPress={() => void Linking.openURL(imageUri)}
            accessibilityRole="imagebutton"
            accessibilityLabel={tl(block.alt)}
          >
            <Image
              source={{ uri: imageUri }}
              style={{ width, height: width / imageRatio }}
              resizeMode="contain"
            />
          </Pressable>
        ) : !xml && !imageUri ? (
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
