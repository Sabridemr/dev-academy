import type { ComponentType } from 'react';
import { Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { InteractiveType, LessonBlock } from '@devacademy/shared';
import { env } from '@/config/env';
import { useI18n } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { Button, Card, Row, Text } from '@/components/ui';
import { MarkdownView } from '@/components/lesson/MarkdownView';
import { CacheSim } from './CacheSim';
import { ConsistentHashingSim } from './ConsistentHashingSim';
import { GradientDescentSim } from './GradientDescentSim';
import { LoadBalancerSim } from './LoadBalancerSim';
import { RateLimiterSim } from './RateLimiterSim';
import { useInteractiveSession, type SimProps } from './common';

/**
 * İNTERAKTİF SİMÜLATÖR KAYDI
 * Mobilde gerçek etkileşimli olanlar burada; listede olmayan InteractiveType değerleri için
 * başlık/yönergeyi gösteren ve web sürümünü açan bir yedek kart kullanılır.
 */
export const MOBILE_SIMULATORS: Partial<Record<InteractiveType, ComponentType<SimProps>>> = {
  'load-balancer': LoadBalancerSim,
  cache: CacheSim,
  'rate-limiter': RateLimiterSim,
  'consistent-hashing': ConsistentHashingSim,
  'gradient-descent': GradientDescentSim,
};

export function isSupportedOnMobile(type: InteractiveType): boolean {
  return Boolean(MOBILE_SIMULATORS[type]);
}

type InteractiveBlock = Extract<LessonBlock, { type: 'interactive' }>;

export function InteractiveBlockView({ block, lessonId }: { block: InteractiveBlock; lessonId: string }) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const onInteract = useInteractiveSession(block.interactive, lessonId, block.params);
  const Sim = MOBILE_SIMULATORS[block.interactive];

  return (
    <Card testID={`interactive-${block.interactive}`}>
      <Row>
        <Ionicons name="flask-outline" size={18} color={colors.primary} />
        <Text variant="subheading" style={{ flex: 1 }}>
          {block.title ? tl(block.title) : block.interactive}
        </Text>
      </Row>
      {block.instructions ? <MarkdownView compact>{tl(block.instructions)}</MarkdownView> : null}
      {Sim ? (
        <Sim params={block.params} lessonId={lessonId} onInteract={onInteract} />
      ) : (
        <View style={{ gap: spacing.sm }} testID="interactive-fallback">
          <Text variant="caption" muted>
            {t('sim.unsupported')}
          </Text>
          <Button
            title={t('sim.openOnWeb')}
            variant="secondary"
            icon="open-outline"
            onPress={() => void Linking.openURL(`${env.webUrl}/lessons/${encodeURIComponent(lessonId)}`)}
          />
        </View>
      )}
    </Card>
  );
}
