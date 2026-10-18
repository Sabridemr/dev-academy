import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBookmarks, useLesson } from '@/hooks/content';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { useI18n } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { useSession } from '@/stores/session';
import { spacing, useTheme } from '@/theme';
import { Button, Chip, ErrorView, IconButton, LoadingView, OfflineBanner, ProgressBar, Row, Text } from '@/components/ui';
import { BlockRenderer } from '@/components/lesson/BlockRenderer';
import { NoteModal } from '@/components/lesson/NoteModal';

/**
 * DERS GÖRÜNTÜLEYİCİ
 * Tüm blok türlerini sırayla çizer; kaydırma konumundan görüntülenen blokları izler (ilerleme yüzdesi),
 * yer imi ve not eylemleri başlıkta.
 */
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const authed = useSession((s) => s.status === 'authenticated');
  const lesson = useLesson(id);
  const bookmarks = useBookmarks();
  const progress = useLessonProgress(lesson.data);
  const [noteOpen, setNoteOpen] = useState(false);
  const blockOffsets = useRef(new Map<string, { y: number; h: number }>());
  const viewport = useRef({ y: 0, h: 0 });

  const blocks = useMemo(() => [...(lesson.data?.blocks ?? [])].sort((a, b) => a.order - b.order), [lesson.data]);
  const bookmark = bookmarks.data?.find((b) => b.lessonId === lesson.data?.id && !b.blockId);

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!lesson.data) return;
      if (bookmark) await endpoints.removeBookmark(bookmark.id);
      else await endpoints.addBookmark({ lessonId: lesson.data.id });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.bookmarks }),
  });

  /** Görünür alana giren blokları "görüntülendi" işaretle */
  const checkVisibility = useCallback(() => {
    const { y, h } = viewport.current;
    if (h === 0) return;
    const bottom = y + h * 0.85;
    blockOffsets.current.forEach((pos, blockId) => {
      if (pos.y < bottom) progress.markViewed(blockId);
    });
  }, [progress]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    viewport.current = { y: e.nativeEvent.contentOffset.y, h: e.nativeEvent.layoutMeasurement.height };
    checkVisibility();
  };

  const onBlockLayout = (blockId: string) => (e: LayoutChangeEvent) => {
    blockOffsets.current.set(blockId, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height });
    checkVisibility();
  };

  if (lesson.isLoading) return <LoadingView />;
  if (lesson.error || !lesson.data) return <ErrorView error={lesson.error} onRetry={() => void lesson.refetch()} />;
  const l = lesson.data;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }} testID="lesson-screen">
      <Stack.Screen
        options={{
          title: `${l.module.code} · ${l.order}`,
          headerRight: () =>
            authed ? (
              <Row gap={spacing.xs}>
                <IconButton
                  icon={bookmark ? 'bookmark' : 'bookmark-outline'}
                  label={bookmark ? t('lesson.bookmarked') : t('lesson.bookmark')}
                  active={Boolean(bookmark)}
                  onPress={() => toggleBookmark.mutate()}
                  testID="lesson-bookmark"
                />
                <IconButton icon="create-outline" label={t('lesson.note')} onPress={() => setNoteOpen(true)} testID="lesson-note" />
              </Row>
            ) : null,
        }}
      />
      <OfflineBanner />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 4 }}>
        <ProgressBar value={progress.percent / 100} label={t('lesson.progress')} />
      </View>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={120}
        onLayout={(e) => {
          viewport.current = { ...viewport.current, h: e.nativeEvent.layout.height };
          checkVisibility();
        }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            {l.module.code}. {tl(l.module.title)}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {tl(l.title)}
          </Text>
          <Text muted>{tl(l.summary)}</Text>
          <Row wrap>
            <Chip label={t('module.minutes', { count: l.durationMinutes })} />
            <Chip label={t(`module.level.${l.level}`)} />
            {progress.completed ? <Chip tone="success" label={t('lesson.completed')} /> : null}
          </Row>
        </View>

        {blocks.map((block) => (
          <View key={block.id} onLayout={onBlockLayout(block.id)} testID={`block-${block.type}-${block.id}`}>
            <BlockRenderer block={block} lesson={l} onQuizPassed={() => void progress.markCompleted()} />
          </View>
        ))}

        {authed && !progress.completed ? (
          <Button title={t('lesson.markComplete')} icon="checkmark-done" onPress={() => void progress.markCompleted()} testID="lesson-complete" />
        ) : null}
        <Row style={{ justifyContent: 'space-between' }}>
          {l.prev ? (
            <Button compact variant="secondary" icon="arrow-back" title={t('lesson.prev')} onPress={() => router.replace({ pathname: '/lesson/[id]', params: { id: l.prev!.id } })} />
          ) : (
            <View />
          )}
          {l.next ? (
            <Button compact icon="arrow-forward" title={t('lesson.next')} onPress={() => router.replace({ pathname: '/lesson/[id]', params: { id: l.next!.id } })} />
          ) : null}
        </Row>
      </ScrollView>
      <NoteModal visible={noteOpen} lessonId={l.id} onClose={() => setNoteOpen(false)} />
    </SafeAreaView>
  );
}
