import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  RATE_LIMIT_ALGORITHMS,
  advanceRateLimiter,
  createRateLimiter,
  rateLimiterFill,
  tryAcquire,
  type RateLimitAlgorithm,
  type RateLimitDecision,
  type RateLimiterConfig,
  type RateLimiterState,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { Button, ProgressBar, Row, SegmentedControl, Stepper, Text } from '@/components/ui';
import { Stat, StatRow, paramNumber, paramString, useInterval, type SimProps } from './common';

const ALGOS = RATE_LIMIT_ALGORITHMS.map((a) => a.id);

/** Rate limiter simülatörü — token/leaky bucket ve pencere algoritmaları shared/rateLimiter'dan */
export function RateLimiterSim({ params, onInteract }: SimProps) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const [config, setConfig] = useState<RateLimiterConfig>(() => ({
    algorithm: paramString<RateLimitAlgorithm>(params, 'algorithm', ALGOS, 'token-bucket'),
    limit: Math.max(1, Math.min(20, paramNumber(params, 'limit', 5))),
    windowMs: Math.max(1000, Math.min(10000, paramNumber(params, 'windowMs', 3000))),
    ratePerSec: Math.max(1, Math.min(10, paramNumber(params, 'ratePerSec', 2))),
  }));
  const [limiter, setLimiter] = useState<RateLimiterState>(() =>
    createRateLimiter(config, Date.now()),
  );
  const limiterRef = useRef(limiter);
  const [decisions, setDecisions] = useState<RateLimitDecision[]>([]);
  const [counts, setCounts] = useState({ allowed: 0, rejected: 0 });
  const [auto, setAuto] = useState(false);

  const apply = (next: RateLimiterState) => {
    limiterRef.current = next;
    setLimiter(next);
  };

  const reconfigure = (patch: Partial<RateLimiterConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    apply(createRateLimiter(next, Date.now()));
    setDecisions([]);
    setCounts({ allowed: 0, rejected: 0 });
  };

  const send = (n = 1) => {
    onInteract();
    let s = limiterRef.current;
    const newDecisions: RateLimitDecision[] = [];
    for (let i = 0; i < n; i++) {
      const res = tryAcquire(s, Date.now());
      s = res.state;
      newDecisions.push(res.decision);
    }
    apply(s);
    setDecisions((d) => [...d, ...newDecisions].slice(-30));
    const allowed = newDecisions.filter((d) => d.allowed).length;
    setCounts((c) => ({
      allowed: c.allowed + allowed,
      rejected: c.rejected + newDecisions.length - allowed,
    }));
  };

  // Zaman akışı: dolum/sızma ve pencere kaydırma görselleştirmesi
  useInterval(() => apply(advanceRateLimiter(limiterRef.current, Date.now())), 200);
  useInterval(() => send(1), auto ? 200 : null);

  const fill = rateLimiterFill(limiter);
  const last = decisions[decisions.length - 1];
  const usesWindow =
    config.algorithm === 'fixed-window' ||
    config.algorithm === 'sliding-window-log' ||
    config.algorithm === 'sliding-window-counter';

  return (
    <View style={{ gap: spacing.md }} testID="sim-rate-limiter">
      <SegmentedControl
        label={t('sim.algorithm')}
        wrap
        value={config.algorithm}
        onChange={(algorithm) => reconfigure({ algorithm })}
        options={RATE_LIMIT_ALGORITHMS.map((a) => ({ value: a.id, label: tl(a.label) }))}
      />
      <Stepper
        label={t('sim.limit')}
        value={config.limit}
        min={1}
        max={20}
        onChange={(limit) => reconfigure({ limit })}
      />
      {usesWindow ? (
        <Stepper
          label={t('sim.window')}
          value={config.windowMs}
          min={1000}
          max={10000}
          step={1000}
          onChange={(windowMs) => reconfigure({ windowMs })}
        />
      ) : (
        <Stepper
          label={t('sim.rate')}
          value={config.ratePerSec}
          min={1}
          max={10}
          onChange={(ratePerSec) => reconfigure({ ratePerSec })}
        />
      )}
      <Row wrap>
        <Button
          compact
          title={t('sim.send')}
          icon="paper-plane"
          onPress={() => send(1)}
          testID="rl-send"
        />
        <Button compact variant="secondary" title={t('sim.burst')} onPress={() => send(10)} />
        <Button
          compact
          variant={auto ? 'danger' : 'secondary'}
          title={auto ? t('sim.stop') : t('sim.auto')}
          icon={auto ? 'stop' : 'play'}
          onPress={() => {
            onInteract();
            setAuto((a) => !a);
          }}
        />
      </Row>

      <Text variant="caption">
        {t('sim.fill')}: {Math.round(fill * 100)}%
      </Text>
      <ProgressBar
        value={fill}
        height={10}
        color={fill > 0.85 ? colors.danger : fill > 0.5 ? colors.warning : colors.success}
        label={t('sim.fill')}
      />

      <View
        style={styles.timeline}
        accessibilityLabel={`${t('sim.allowed')} ${counts.allowed}, ${t('sim.rejected')} ${counts.rejected}`}
      >
        {decisions.map((d, i) => (
          <View
            key={`${d.at}-${i}`}
            style={[styles.dot, { backgroundColor: d.allowed ? colors.success : colors.danger }]}
          />
        ))}
      </View>
      {last ? (
        <Text variant="caption" muted accessibilityLiveRegion="polite">
          {last.allowed ? '✓' : '✗'} {last.reason}
        </Text>
      ) : null}
      <StatRow>
        <Stat label={t('sim.allowed')} value={String(counts.allowed)} color={colors.success} />
        <Stat label={t('sim.rejected')} value={String(counts.rejected)} color={colors.danger} />
      </StatRow>
      <Button
        compact
        variant="ghost"
        title={t('sim.reset')}
        icon="refresh"
        onPress={() => {
          setAuto(false);
          reconfigure({});
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, minHeight: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
