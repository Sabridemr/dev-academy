import { Pressable, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useConcept } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';
import { Chip, ErrorView, LoadingView, Row, Screen, Text } from '@/components/ui';
import { conceptDefinition, conceptTerms } from '@/components/content/concept-text';

/** Kavram detayı: tanım, diğer adlar, geçtiği dersler ve ilgili kavramlar */
export default function ConceptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, tl, locale } = useI18n();
  const { colors } = useTheme();
  const concept = useConcept(id);

  if (concept.isLoading) return <LoadingView />;
  if (concept.error || !concept.data)
    return <ErrorView error={concept.error} onRetry={() => void concept.refetch()} />;
  const c = concept.data;
  const { primary, secondary } = conceptTerms(c.term, locale);

  return (
    <Screen edges={[]} testID="concept-screen">
      <Stack.Screen options={{ title: primary }} />
      <Text variant="title" accessibilityRole="header">
        {primary}
      </Text>
      {secondary ? <Text muted>{secondary}</Text> : null}
      <Text>{conceptDefinition(c.definition, locale)}</Text>
      {c.aliases.length ? (
        <Text variant="caption" muted>
          {t('glossary.aliases')}: {c.aliases.join(', ')}
        </Text>
      ) : null}

      <Text variant="subheading" accessibilityRole="header">
        {t('glossary.lessonsTitle')}
      </Text>
      {c.lessons.length === 0 ? (
        <Text variant="caption" muted>
          {t('glossary.noLessons')}
        </Text>
      ) : null}
      {c.lessons.map((l) => (
        <Pressable
          key={l.id}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: l.id } })}
          style={({ pressed }) => [
            styles.lesson,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.elevated : colors.surface,
            },
          ]}
          testID={`concept-lesson-${l.id}`}
        >
          <Text variant="caption" muted>
            {l.moduleCode}
          </Text>
          <Text variant="label">{tl(l.title)}</Text>
        </Pressable>
      ))}

      {c.related.length ? (
        <>
          <Text variant="subheading" accessibilityRole="header">
            {t('glossary.relatedTitle')}
          </Text>
          <Row wrap>
            {c.related.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/glossary/[id]', params: { id: r.id } })}
              >
                <Chip label={conceptTerms(r.term, locale).primary} />
              </Pressable>
            ))}
          </Row>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lesson: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
});
