import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchConcepts, type ConceptSummary } from '@devacademy/shared';
import { useConcepts } from '@/hooks/content';
import { useDebounced } from '@/hooks/useDebounced';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';
import { EmptyState, ErrorView, LoadingView, Screen, Text } from '@/components/ui';
import { conceptDefinition, conceptTerms } from '@/components/content/concept-text';

/** Kavram sözlüğü: GET /concepts bir kez yüklenir, arama shared `searchConcepts` ile istemcide */
export default function GlossaryScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const concepts = useConcepts();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 150);

  const items = useMemo(() => {
    const all = [...(concepts.data ?? [])].sort((a, b) =>
      conceptTerms(a.term, locale).primary.localeCompare(
        conceptTerms(b.term, locale).primary,
        locale,
      ),
    );
    return q ? searchConcepts(all, q, locale) : all;
  }, [concepts.data, q, locale]);

  const renderItem = ({ item }: { item: ConceptSummary }) => {
    const { primary, secondary } = conceptTerms(item.term, locale);
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/glossary/[id]', params: { id: item.id } })}
        accessibilityRole="button"
        testID={`concept-${item.id}`}
        style={({ pressed }) => [
          styles.item,
          {
            borderColor: colors.border,
            backgroundColor: pressed ? colors.elevated : colors.surface,
          },
        ]}
      >
        <Text variant="label">{primary}</Text>
        {secondary ? (
          <Text variant="caption" muted>
            {secondary}
          </Text>
        ) : null}
        <Text variant="caption" muted numberOfLines={2}>
          {conceptDefinition(item.definition, locale)}
        </Text>
      </Pressable>
    );
  };

  return (
    <Screen edges={[]} scroll={false} contentStyle={styles.content} testID="glossary-screen">
      <View
        style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('glossary.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('glossary.searchPlaceholder')}
          style={[styles.input, { color: colors.fg }]}
          testID="glossary-search"
        />
      </View>
      {concepts.isLoading ? <LoadingView /> : null}
      {concepts.error ? (
        <ErrorView error={concepts.error} onRetry={() => void concepts.refetch()} />
      ) : null}
      {concepts.data ? (
        <Text variant="caption" muted accessibilityLiveRegion="polite">
          {t('glossary.resultCount', { count: items.length })}
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }}
        initialNumToRender={20}
        ListEmptyComponent={
          concepts.data ? <EmptyState icon="search-outline" text={t('glossary.empty')} /> : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, minHeight: 48, fontSize: 16 },
  item: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4 },
});
