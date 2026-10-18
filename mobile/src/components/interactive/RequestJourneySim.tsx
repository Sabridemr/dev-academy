import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme, withAlpha, type ThemeColors } from '@/theme';
import { Button, Row, SegmentedControl, Stepper, Text } from '@/components/ui';
import { Stat, StatRow, paramNumber, type SimProps } from './common';
import { ToggleRow, paramBool } from './controls';
import {
  batchJourney,
  buildHops,
  computeJourney,
  parseLayers,
  type HopKind,
  type Journey,
  type JourneyOptions,
} from './requestJourney';
import { useReducedMotion } from './useReducedMotion';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function kindColor(k: HopKind, colors: ThemeColors): string {
  if (k === 'cdn' || k === 'cache') return colors.success;
  if (k === 'db') return colors.accent;
  if (k === 'client') return colors.muted;
  return colors.primary;
}

/**
 * Bir isteğin yolculuğu — katmanlar, kısa devre (CDN/cache hit), hata enjeksiyonu, gecikme bütçesi.
 * Mantık ./requestJourney (web sürümüyle aynı). Paket animasyonu katman başına bir zamanlayıcıyla ilerler.
 */
export function RequestJourneySim({ params, onInteract }: SimProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const reduced = useReducedMotion();

  const layers = useMemo(() => parseLayers(params), [params]);
  const slowSelectable = params.slowService !== undefined;
  const slowPenaltyMs = clamp(paramNumber(params, 'slowPenaltyMs', 300), 1, 5000);
  const failureStage = typeof params.failureStage === 'string' ? params.failureStage : '';
  const coldToggle = paramBool(params, 'showColdStart', false);
  const budget = clamp(paramNumber(params, 'budgetMs', 0), 0, 60_000);

  const [slowService, setSlowService] = useState(() => {
    const s = typeof params.slowService === 'string' ? params.slowService : '';
    return s === 'none' ? '' : s;
  });
  const [coldStart, setColdStart] = useState(coldToggle);
  const [dnsCached, setDnsCached] = useState(false);
  const [cdnHit, setCdnHit] = useState(false);
  const [cacheHit, setCacheHit] = useState(false);
  const [injectFail, setInjectFail] = useState(false);
  const [http3, setHttp3] = useState(() => paramBool(params, 'http3', false));
  const [hitRate, setHitRate] = useState(() =>
    clamp(paramNumber(params, 'cacheHitRate', 70), 0, 100),
  );
  const [rtt, setRtt] = useState(() => clamp(paramNumber(params, 'rttMs', 20), 1, 300));
  const [journey, setJourney] = useState<Journey | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [batch, setBatch] = useState<{ avg: number; p95: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const hops = useMemo(
    () => buildHops(layers, { slowService, slowPenaltyMs, coldToggle, coldStart }),
    [layers, slowService, slowPenaltyMs, coldToggle, coldStart],
  );
  const opts: JourneyOptions = {
    dns: dnsCached,
    cdn: cdnHit,
    cache: cacheHit,
    rttMs: rtt,
    http3,
    injectFail,
    failureStage,
  };

  /** Kontrol değiştiğinde ilk etkileşimi kaydeder */
  const on =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      onInteract();
      set(v);
    };

  const send = () => {
    onInteract();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const j = computeJourney(hops, opts);
    setJourney(j);
    if (reduced) {
      setCursor(j.visited.length);
      return;
    }
    setCursor(0);
    let at = 0;
    j.visited.forEach((v, i) => {
      at += 250 + Math.min(600, v.ms * 2);
      timers.current.push(setTimeout(() => setCursor(i + 1), at));
    });
  };

  const sendBatch = () => {
    onInteract();
    setBatch(batchJourney(hops, opts, hitRate));
  };

  const n = hops.length;
  const done = journey !== null && cursor >= journey.visited.length;
  const hasKind = (k: HopKind) => hops.some((h) => h.kind === k);
  const hasHop = (id: string) => hops.some((h) => h.id.toLowerCase() === id);
  const overBudget =
    budget > 0 && journey !== null && done && !journey.failed && journey.total > budget;
  const maxMs = journey ? Math.max(...journey.visited.map((v) => v.ms), 1) : 1;
  const terminalLabel = journey ? (hops[journey.terminal]?.label ?? '') : '';

  return (
    <View style={{ gap: spacing.md }} testID="sim-request-journey">
      <Row wrap>
        <Button compact title={t('sim.send')} icon="paper-plane" onPress={send} testID="rj-send" />
        <Button
          compact
          variant="secondary"
          title={t('sim.journey.send20')}
          icon="flash-outline"
          onPress={sendBatch}
          testID="rj-batch"
        />
      </Row>

      <Text variant="label">{t('sim.journey.path')}</Text>
      <View accessibilityRole="list" accessibilityLabel={t('sim.journey.path')}>
        {hops.map((h, i) => {
          const reached = journey ? i < Math.min(cursor, journey.visited.length) : false;
          const isTerminal = journey !== null && done && i === journey.terminal;
          const skipped = journey !== null && i > journey.terminal;
          const isCurrent =
            journey !== null &&
            !done &&
            cursor >= 0 &&
            i === Math.min(Math.max(cursor - 1, 0), n - 1);
          const c = kindColor(h.kind, colors);
          const border =
            isTerminal && journey?.failed ? colors.danger : reached ? c : colors.border;
          const bg = isTerminal
            ? withAlpha(journey?.failed ? colors.danger : c, 0.18)
            : colors.surface;
          const isSlow = h.id === slowService;
          const detail =
            journey && reached
              ? `${Math.round(journey.visited[i].ms)} ms`
              : isSlow
                ? t('sim.journey.slow')
                : h.kind;
          return (
            <View key={`${h.id}-${i}`} style={{ opacity: skipped ? 0.35 : 1 }}>
              {i > 0 ? (
                <View
                  style={[styles.connector, { backgroundColor: reached ? c : colors.border }]}
                />
              ) : null}
              <View
                style={[
                  styles.hop,
                  { borderColor: border, backgroundColor: bg, borderWidth: reached ? 2 : 1 },
                ]}
                accessible
                accessibilityLabel={`${i + 1}. ${h.label}: ${detail}`}
                testID={`rj-hop-${i}`}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isCurrent ? colors.accent : withAlpha(c, reached ? 1 : 0.35),
                    },
                  ]}
                />
                <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                  {h.label}
                </Text>
                <Text variant="caption" color={isSlow ? colors.danger : colors.muted}>
                  {detail}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {journey && done ? (
        <Text
          variant="caption"
          weight="600"
          color={journey.failed ? colors.danger : colors.success}
          accessibilityLiveRegion="polite"
          testID="rj-result"
        >
          {journey.failed
            ? t('sim.journey.failed', { stage: terminalLabel })
            : t('sim.journey.served', { stage: terminalLabel })}{' '}
          · {Math.round(journey.total)} ms
        </Text>
      ) : null}

      {hasKind('dns') ? (
        <ToggleRow
          label={t('sim.journey.dnsCached')}
          value={dnsCached}
          onChange={on(setDnsCached)}
        />
      ) : null}
      {hasKind('cdn') ? (
        <ToggleRow
          label={t('sim.journey.cdnHit')}
          value={cdnHit}
          onChange={on(setCdnHit)}
          testID="rj-cdn"
        />
      ) : null}
      {hasKind('cache') ? (
        <ToggleRow
          label={t('sim.journey.cacheHit')}
          value={cacheHit}
          onChange={on(setCacheHit)}
          testID="rj-cache"
        />
      ) : null}
      {failureStage && hops.some((h) => h.id === failureStage) ? (
        <ToggleRow
          label={t('sim.journey.fail', { stage: failureStage })}
          value={injectFail}
          onChange={on(setInjectFail)}
          testID="rj-fail"
        />
      ) : null}
      {hasHop('tcp') && hasHop('tls') ? (
        <ToggleRow label={t('sim.journey.http3')} value={http3} onChange={on(setHttp3)} />
      ) : null}
      {coldToggle && hops.some((h) => h.id.toLowerCase().includes('lambda')) ? (
        <ToggleRow
          label={t('sim.journey.coldStart')}
          value={coldStart}
          onChange={on(setColdStart)}
          testID="rj-cold"
        />
      ) : null}
      {slowSelectable ? (
        <SegmentedControl
          label={t('sim.journey.slowLayer', { ms: slowPenaltyMs })}
          wrap
          value={slowService}
          onChange={on(setSlowService)}
          options={[
            { value: '', label: t('sim.journey.none') },
            ...hops.filter((h) => h.kind !== 'client').map((h) => ({ value: h.id, label: h.id })),
          ]}
        />
      ) : null}
      <Stepper
        label={t('sim.journey.rtt')}
        value={rtt}
        min={1}
        max={200}
        step={5}
        onChange={on(setRtt)}
      />
      {hasKind('cache') ? (
        <Stepper
          label={t('sim.journey.hitRate')}
          value={hitRate}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={setHitRate}
        />
      ) : null}

      <StatRow>
        <Stat
          label={t('sim.journey.total')}
          value={journey && done ? `${Math.round(journey.total)} ms` : '—'}
          color={journey?.failed || overBudget ? colors.danger : colors.primary}
        />
        <Stat
          label={t('sim.journey.hops')}
          value={journey ? `${journey.visited.length}/${n}` : '—'}
        />
        {budget > 0 ? (
          <Stat
            label={t('sim.journey.budget')}
            value={`${budget} ms`}
            color={overBudget ? colors.danger : colors.success}
          />
        ) : null}
        {batch ? <Stat label={t('sim.journey.avg')} value={`${Math.round(batch.avg)} ms`} /> : null}
        {batch ? (
          <Stat
            label={t('sim.journey.p95')}
            value={`${Math.round(batch.p95)} ms`}
            color={budget > 0 && batch.p95 > budget ? colors.danger : colors.warning}
          />
        ) : null}
      </StatRow>
      {budget > 0 && journey && done && !journey.failed ? (
        <Text
          variant="caption"
          color={overBudget ? colors.danger : colors.success}
          accessibilityLiveRegion="polite"
        >
          {overBudget
            ? t('sim.journey.overBudget', { ms: Math.round(journey.total) })
            : t('sim.journey.inBudget')}
        </Text>
      ) : null}

      {journey ? (
        <View style={{ gap: 4 }} accessibilityLabel={t('sim.journey.waterfall')}>
          <Text variant="label">{t('sim.journey.waterfall')}</Text>
          {(() => {
            let offset = 0;
            const total = Math.max(1, journey.total);
            return journey.visited.map((v, i) => {
              const left = offset / total;
              offset += v.ms;
              return (
                <Row key={i} style={{ opacity: i < cursor ? 1 : 0.3 }}>
                  <Text variant="caption" style={{ width: 96 }} numberOfLines={1}>
                    {v.hop.label}
                  </Text>
                  <View style={[styles.track, { backgroundColor: colors.elevated }]}>
                    <View
                      style={{
                        position: 'absolute',
                        left: `${left * 100}%`,
                        width: `${Math.max(1, (v.ms / total) * 100)}%`,
                        top: 0,
                        bottom: 0,
                        borderRadius: 3,
                        backgroundColor: kindColor(v.hop.kind, colors),
                        opacity: 0.4 + (0.6 * v.ms) / maxMs,
                      }}
                    />
                  </View>
                  <Text variant="caption" muted style={{ width: 56, textAlign: 'right' }}>
                    {v.ms.toFixed(v.ms < 10 ? 1 : 0)} ms
                  </Text>
                </Row>
              );
            });
          })()}
        </View>
      ) : null}

      <Text variant="caption" muted>
        {t('sim.journey.hint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  connector: { width: 2, height: 10, marginLeft: spacing.md + 4 },
  track: { flex: 1, height: 12, borderRadius: 3, overflow: 'hidden' },
});
