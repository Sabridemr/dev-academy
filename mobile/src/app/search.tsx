import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { SearchResult } from '@devacademy/shared';
import { useDebounced } from '@/hooks/useDebounced';
import { useI18n } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { radius, spacing, useTheme } from '@/theme';
import { Chip, EmptyState, ErrorView, LoadingView, Screen, Text } from '@/components/ui';

/** Arama: GET /search?q= (300 ms debounce) */
export default function SearchScreen() {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 300);
  const search = useQuery({
    queryKey: queryKeys.search(q),
    enabled: q.length >= 2,
    queryFn: ({ signal }) => endpoints.search(q, signal),
    staleTime: 5 * 60_000,
  });

  const open = (r: SearchResult) => {
    if (r.type === 'module') router.push({ pathname: '/module/[id]', params: { id: r.id } });
    else if (r.type === 'lesson') router.push({ pathname: '/lesson/[id]', params: { id: r.id } });
    else if (r.moduleId) router.push({ pathname: '/lesson/[id]', params: { id: r.slug || r.id } });
  };

  return (
    <Screen edges={[]} testID="search-screen">
      <View
        style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.muted}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('nav.search')}
          style={[styles.input, { color: colors.fg }]}
          testID="search-input"
        />
      </View>
      {q.length < 2 ? (
        <Text variant="caption" muted>
          {t('search.minChars')}
        </Text>
      ) : null}
      {search.isFetching && !search.data ? <LoadingView /> : null}
      {search.error ? (
        <ErrorView error={search.error} onRetry={() => void search.refetch()} />
      ) : null}
      {search.data ? (
        <Text variant="caption" muted accessibilityLiveRegion="polite">
          {t('search.results', { count: search.data.results.length })}
        </Text>
      ) : null}
      {search.data?.results.length === 0 ? (
        <EmptyState icon="search-outline" text={t('search.empty')} />
      ) : null}
      {(search.data?.results ?? []).map((r) => (
        <Pressable
          key={`${r.type}-${r.id}`}
          onPress={() => open(r)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.result,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.elevated : colors.surface,
            },
          ]}
        >
          <Chip
            label={t(`search.types.${r.type}`)}
            tone={r.type === 'lesson' ? 'primary' : r.type === 'module' ? 'success' : 'warning'}
          />
          <Text variant="label">{tl(r.title)}</Text>
          {r.snippet ? (
            <Text variant="caption" muted numberOfLines={2}>
              {r.snippet.replace(/<\/?[^>]+>/g, '')}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, minHeight: 48, fontSize: 16 },
  result: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4 },
});
