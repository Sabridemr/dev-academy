import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBookmarks, useNotes } from '@/hooks/content';
import { useI18n } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { radius, spacing, useTheme } from '@/theme';
import {
  EmptyState,
  ErrorView,
  IconButton,
  LoadingView,
  Screen,
  SegmentedControl,
  Text,
} from '@/components/ui';

/** Kütüphane: yer imleri ve notlar */
export default function LibraryScreen() {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'bookmarks' | 'notes'>('bookmarks');
  const bookmarks = useBookmarks();
  const notes = useNotes();

  const removeBookmark = useMutation({
    mutationFn: (id: string) => endpoints.removeBookmark(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.bookmarks }),
  });
  const removeNote = useMutation({
    mutationFn: (id: string) => endpoints.removeNote(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notes'] }),
  });

  const active = tab === 'bookmarks' ? bookmarks : notes;
  // Not satırında ders başlığı için yer imlerindeki ders bilgisini kullan (yoksa ders kimliği)
  const lessonTitle = (lessonId: string) => {
    const b = bookmarks.data?.find((x) => x.lessonId === lessonId);
    return b ? tl(b.lesson.title) : lessonId;
  };

  return (
    <Screen
      refreshing={active.isRefetching}
      onRefresh={() => {
        void bookmarks.refetch();
        void notes.refetch();
      }}
      testID="library-screen"
    >
      <Text variant="heading" accessibilityRole="header">
        {t('library.title')}
      </Text>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'bookmarks', label: t('library.bookmarks') },
          { value: 'notes', label: t('library.notes') },
        ]}
      />
      {active.isLoading ? <LoadingView /> : null}
      {active.error ? (
        <ErrorView error={active.error} onRetry={() => void active.refetch()} />
      ) : null}

      {tab === 'bookmarks' ? (
        bookmarks.data?.length === 0 ? (
          <EmptyState icon="bookmark-outline" text={t('library.empty')} />
        ) : (
          (bookmarks.data ?? []).map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: b.lessonId } })}
              accessibilityRole="button"
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="bookmark" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{tl(b.lesson.title)}</Text>
                <Text variant="caption" muted>
                  {new Date(b.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <IconButton
                icon="trash-outline"
                label={t('library.delete')}
                onPress={() => removeBookmark.mutate(b.id)}
              />
            </Pressable>
          ))
        )
      ) : notes.data?.length === 0 ? (
        <EmptyState icon="document-text-outline" text={t('library.empty')} />
      ) : (
        (notes.data ?? []).map((n) => (
          <Pressable
            key={n.id}
            onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: n.lessonId } })}
            accessibilityRole="button"
            style={[
              styles.row,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: 'flex-start',
              },
            ]}
          >
            <Ionicons name="document-text" size={18} color={colors.accent} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="caption" muted>
                {lessonTitle(n.lessonId)} · {new Date(n.updatedAt).toLocaleDateString()}
              </Text>
              <Text>{n.body}</Text>
            </View>
            <IconButton
              icon="trash-outline"
              label={t('library.delete')}
              onPress={() => removeNote.mutate(n.id)}
            />
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
