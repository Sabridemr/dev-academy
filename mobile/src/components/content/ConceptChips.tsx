import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useConcepts } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { spacing } from '@/theme';
import { Chip, Row, Text } from '@/components/ui';
import { conceptTerms } from './concept-text';

/**
 * Ders başlığı altında "Bu dersteki kavramlar" çipleri; dokununca sözlük detayı açılır.
 * Terim sözlükten çözülür; sözlük yüklenemezse (ör. çevrimdışı) kavram id'si gösterilir.
 */
export function ConceptChips({ concepts = [] }: { concepts?: string[] }) {
  const { t, locale } = useI18n();
  const glossary = useConcepts();
  const terms = useMemo(
    () => new Map((glossary.data ?? []).map((c) => [c.id, c.term])),
    [glossary.data],
  );
  if (concepts.length === 0) return null;
  return (
    <View style={{ gap: spacing.xs }} testID="lesson-concepts">
      <Text variant="caption" muted weight="600">
        {t('glossary.lessonConcepts')}
      </Text>
      <Row wrap>
        {concepts.map((id) => {
          const term = terms.get(id);
          const label = term ? conceptTerms(term, locale).primary : id;
          return (
            <Pressable
              key={id}
              accessibilityRole="link"
              accessibilityLabel={label}
              onPress={() => router.push({ pathname: '/glossary/[id]', params: { id } })}
              testID={`concept-chip-${id}`}
            >
              <Chip tone="primary" label={label} />
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}
