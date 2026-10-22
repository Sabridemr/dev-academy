import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LessonBlock, ResourceKind } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { Card, Row, Text, type IconName } from '@/components/ui';

type ResourcesBlock = Extract<LessonBlock, { type: 'resources' }>;

const KIND_ICONS: Record<ResourceKind, IconName> = {
  book: 'book',
  article: 'newspaper',
  docs: 'document-text',
  video: 'play-circle',
  paper: 'school',
  repo: 'git-branch',
};

/** Ders sonu kaynakça: her öğe sistem tarayıcısında açılır */
export function ResourcesBlockView({ block }: { block: ResourcesBlock }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Card>
      <Row>
        <Ionicons name="library" size={18} color={colors.accent} />
        <Text variant="label" accessibilityRole="header">
          {t('lesson.resources.title')}
        </Text>
      </Row>
      <View style={{ gap: spacing.sm }}>
        {block.items.map((item) => {
          const kind = item.kind ? t(`lesson.resources.kind.${item.kind}`) : null;
          const meta = [kind, item.note].filter(Boolean).join(' · ');
          return (
            <Pressable
              key={item.url}
              onPress={() => void Linking.openURL(item.url)}
              accessibilityRole="link"
              accessibilityLabel={meta ? `${item.title}, ${meta}` : item.title}
              accessibilityHint={t('lesson.resources.opensInBrowser')}
              style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
              testID={`resource-${item.url}`}
            >
              <Ionicons
                name={item.kind ? KIND_ICONS[item.kind] : 'link'}
                size={18}
                color={colors.muted}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text variant="label" color={colors.primary}>
                  {item.title}
                </Text>
                {meta ? (
                  <Text variant="caption" muted>
                    {meta}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name="open-outline"
                size={14}
                color={colors.muted}
                style={{ marginTop: 4 }}
              />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 44 },
});
