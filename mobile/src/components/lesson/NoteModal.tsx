import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { radius, spacing, useTheme } from '@/theme';
import { Button, Row, Text } from '@/components/ui';
import { errorText } from '@/utils/errors';

/** Ders notu ekleme penceresi (POST /notes) */
export function NoteModal({
  visible,
  lessonId,
  onClose,
}: {
  visible: boolean;
  lessonId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const save = useMutation({
    mutationFn: () => endpoints.createNote({ lessonId, body: body.trim() }),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey: ['notes'] });
      onClose();
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text variant="subheading" accessibilityRole="header">
            {t('lesson.note')}
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t('lesson.notePlaceholder')}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={5000}
            autoFocus
            accessibilityLabel={t('lesson.note')}
            style={[
              styles.input,
              { color: colors.fg, borderColor: colors.border, backgroundColor: colors.bg },
            ]}
          />
          {save.error ? (
            <Text variant="caption" color={colors.danger}>
              {errorText(save.error, t)}
            </Text>
          ) : null}
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button compact variant="ghost" title={t('common.cancel')} onPress={onClose} />
            <Button
              compact
              title={t('lesson.saveNote')}
              icon="save-outline"
              disabled={!body.trim()}
              loading={save.isPending}
              onPress={() => save.mutate()}
            />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
