import { router } from 'expo-router';
import { useI18n } from '@/i18n';
import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <Screen edges={[]}>
      <EmptyState icon="help-circle-outline" text={t('common.notFound')} />
      <Button title={t('common.goHome')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
