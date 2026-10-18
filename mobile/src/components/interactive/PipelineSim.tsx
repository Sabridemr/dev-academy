import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n, type MessageKey } from '@/i18n';
import { radius, spacing, useTheme, withAlpha, type ThemeColors } from '@/theme';
import { Button, ProgressBar, Row, SegmentedControl, Stepper, Text } from '@/components/ui';
import { Stat, StatRow, paramNumber, useInterval, type SimProps } from './common';
import { ToggleRow } from './controls';
import {
  CANARY_THRESHOLD,
  STRATEGIES,
  createPipelineState,
  defaultFailStage,
  fleetView,
  parseStages,
  pipelineTick,
  type PipelineLog,
  type PipelineState,
  type StageStatus,
  type Strategy,
} from './pipeline';
import { useReducedMotion } from './useReducedMotion';

const STRATEGY_KEY: Record<Strategy, MessageKey> = {
  rolling: 'sim.pipeline.strategies.rolling',
  'blue-green': 'sim.pipeline.strategies.blueGreen',
  canary: 'sim.pipeline.strategies.canary',
};

function statusColor(s: StageStatus, colors: ThemeColors): string {
  if (s === 'success') return colors.success;
  if (s === 'failed' || s === 'rolledback') return colors.danger;
  if (s === 'running') return colors.primary;
  if (s === 'skipped') return colors.muted;
  return colors.border;
}

/** CI/CD pipeline — aşamalar, hata enjeksiyonu + yeniden deneme, canary analizi ve dağıtım stratejileri */
export function PipelineSim({ params, onInteract }: SimProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [stages] = useState(() => parseStages(params));
  const [failAt, setFailAt] = useState(() =>
    defaultFailStage(stages, typeof params.failureStage === 'string' ? params.failureStage : ''),
  );
  const [inject, setInject] = useState(false);
  const [canaryErr, setCanaryErr] = useState(0.5);
  const [retries, setRetries] = useState(() =>
    Math.max(0, Math.min(3, paramNumber(params, 'retries', 1))),
  );
  const [strategy, setStrategy] = useState<Strategy>('canary');
  const [state, setState] = useState<PipelineState>(() => createPipelineState(stages.length));
  const [log, setLog] = useState<
    { id: number; text: string; tone: 'success' | 'danger' | 'muted' }[]
  >([]);
  const seq = useRef(0);

  const logText = (l: PipelineLog): { text: string; tone: 'success' | 'danger' | 'muted' } => {
    switch (l.type) {
      case 'start':
        return { text: t('sim.pipeline.logStart', { stage: l.stage }), tone: 'muted' };
      case 'ok':
        return { text: t('sim.pipeline.logOk', { stage: l.stage }), tone: 'success' };
      case 'retry':
        return {
          text: t('sim.pipeline.logRetry', { stage: l.stage, n: l.attempt }),
          tone: 'danger',
        };
      case 'fail':
        return { text: t('sim.pipeline.logFail', { stage: l.stage }), tone: 'danger' };
      default:
        return { text: t('sim.pipeline.logRollback'), tone: 'danger' };
    }
  };

  useInterval(
    () => {
      const res = pipelineTick(state, stages, { inject, failAt, canaryErr, retries, strategy });
      setState(res.state);
      if (res.logs.length)
        setLog((lg) =>
          [...lg, ...res.logs.map((l) => ({ id: ++seq.current, ...logText(l) }))].slice(-30),
        );
    },
    state.running ? (reduced ? 200 : 600) : null,
  );

  const start = () => {
    onInteract();
    setLog([]);
    setState(createPipelineState(stages.length, true));
  };
  const stop = () => setState((s) => ({ ...s, running: false }));
  const reset = () => {
    setState(createPipelineState(stages.length));
    setLog([]);
  };

  const fleet = fleetView(state, strategy);
  const rolledBack = state.outcome === 'rolledback';
  const outcomeText =
    state.outcome === 'ok'
      ? t('sim.pipeline.ok')
      : state.outcome === 'failed'
        ? t('sim.pipeline.failed', { stage: failAt })
        : state.outcome === 'rolledback'
          ? t('sim.pipeline.rolled', { err: canaryErr, threshold: CANARY_THRESHOLD })
          : state.running
            ? '…'
            : '—';

  return (
    <View style={{ gap: spacing.md }} testID="sim-pipeline">
      <Row wrap>
        <Button
          compact
          variant={state.running ? 'danger' : 'primary'}
          title={state.running ? t('sim.stop') : t('sim.pipeline.run')}
          icon={state.running ? 'stop' : 'play'}
          onPress={state.running ? stop : start}
          testID="pipe-run"
        />
        <Button compact variant="ghost" title={t('sim.reset')} icon="refresh" onPress={reset} />
      </Row>

      <View style={styles.stages} accessibilityRole="list">
        {stages.map((s, i) => {
          const st = state.status[i];
          const c = statusColor(st, colors);
          const mark =
            st === 'success'
              ? '✓ '
              : st === 'failed' || st === 'rolledback'
                ? '✗ '
                : st === 'running'
                  ? '… '
                  : '';
          const statusLabel = t(`sim.pipeline.statuses.${st}`);
          return (
            <View
              key={`${s}-${i}`}
              style={[
                styles.stage,
                {
                  borderColor: c,
                  borderWidth: st === 'running' ? 2.5 : 1.5,
                  backgroundColor: st === 'idle' ? colors.surface : withAlpha(c, 0.18),
                },
              ]}
              accessible
              accessibilityLabel={`${i + 1}. ${s}: ${statusLabel}`}
              testID={`pipe-stage-${i}`}
            >
              <Text variant="caption" weight="600" numberOfLines={1}>
                {s}
              </Text>
              <Text variant="caption" color={st === 'idle' ? colors.muted : c} numberOfLines={1}>
                {mark}
                {statusLabel}
              </Text>
            </View>
          );
        })}
      </View>
      <Text
        variant="caption"
        weight="600"
        color={
          state.outcome === 'ok' ? colors.success : state.outcome ? colors.danger : colors.muted
        }
        accessibilityLiveRegion="polite"
        testID="pipe-outcome"
      >
        {t('sim.pipeline.status')}: {outcomeText}
      </Text>

      <SegmentedControl
        label={t('sim.pipeline.strategy')}
        wrap
        value={strategy}
        onChange={(v) => {
          onInteract();
          setStrategy(v);
        }}
        options={STRATEGIES.map((s) => ({ value: s, label: t(STRATEGY_KEY[s]) }))}
      />
      <ToggleRow
        label={t('sim.pipeline.inject')}
        value={inject}
        onChange={(v) => {
          onInteract();
          setInject(v);
        }}
        testID="pipe-inject"
      />
      {inject ? (
        <SegmentedControl
          label={t('sim.pipeline.injectAt')}
          wrap
          value={failAt}
          onChange={setFailAt}
          options={stages.map((s) => ({ value: s, label: s }))}
        />
      ) : null}
      <Stepper
        label={t('sim.pipeline.retries')}
        value={retries}
        min={0}
        max={3}
        onChange={setRetries}
      />
      <Stepper
        label={t('sim.pipeline.canaryErr')}
        value={canaryErr}
        min={0}
        max={10}
        step={0.5}
        format={(v) => `${v}%`}
        onChange={(v) => {
          onInteract();
          setCanaryErr(v);
        }}
      />
      <StatRow>
        <Stat label={t('sim.pipeline.duration')} value={`${state.elapsed * 30}s`} />
        <Stat
          label={t('sim.pipeline.traffic')}
          value={`v2 ${fleet.v2Traffic}%`}
          color={rolledBack ? colors.danger : colors.primary}
        />
      </StatRow>

      <Text variant="label">
        {t('sim.pipeline.fleet')} · {t(STRATEGY_KEY[strategy])}
      </Text>
      <View
        style={styles.fleet}
        accessible
        accessibilityLabel={`${t('sim.pipeline.fleet')}: v2 ${fleet.v2Traffic}%`}
      >
        {fleet.versions.map((v, i) => {
          const ready = strategy !== 'blue-green' || v === 1 || fleet.progress > 0;
          const isV2 = v === 2;
          const greenGroup = strategy === 'blue-green' && i >= fleet.versions.length / 2;
          return (
            <View
              key={i}
              style={[
                styles.instance,
                {
                  opacity: ready ? 1 : 0.3,
                  borderColor: isV2 ? colors.primary : greenGroup ? colors.success : colors.border,
                  borderStyle: greenGroup && !isV2 ? 'dashed' : 'solid',
                  backgroundColor: isV2 ? withAlpha(colors.primary, 0.25) : colors.elevated,
                },
              ]}
            >
              <Text variant="label" color={isV2 ? colors.primary : colors.muted}>
                v{v}
              </Text>
            </View>
          );
        })}
      </View>
      <ProgressBar
        value={fleet.v2Traffic / 100}
        color={rolledBack ? colors.danger : colors.primary}
        height={10}
        label={t('sim.pipeline.traffic')}
      />
      <Text variant="caption" muted>
        {t('sim.pipeline.traffic')}: v1 {100 - fleet.v2Traffic}% · v2 {fleet.v2Traffic}%
      </Text>

      {log.length ? <Text variant="label">{t('sim.log')}</Text> : null}
      {log
        .slice(-8)
        .reverse()
        .map((x) => (
          <Text
            key={x.id}
            variant="caption"
            color={
              x.tone === 'success'
                ? colors.success
                : x.tone === 'danger'
                  ? colors.danger
                  : colors.muted
            }
            numberOfLines={2}
          >
            {x.text}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stages: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stage: {
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  fleet: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  instance: {
    width: 56,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
