import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  cacheFlush,
  cacheGet,
  cacheSet,
  createCacheState,
  hitRatio,
  seedCacheDb,
  type CacheState,
  type EvictionPolicy,
  type WritePolicy,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, ProgressBar, Row, SegmentedControl, Stepper, Text } from '@/components/ui';
import { Stat, StatRow, paramNumber, paramString, type SimProps } from './common';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const POLICIES: EvictionPolicy[] = ['lru', 'lfu', 'fifo'];
const WRITE_POLICIES: WritePolicy[] = ['cache-aside', 'write-through', 'write-back'];

function initialState(
  capacity: number,
  policy: EvictionPolicy,
  writePolicy: WritePolicy,
  ttl: number,
): CacheState {
  return seedCacheDb(createCacheState({ capacity, policy, writePolicy, defaultTtlMs: ttl }), KEYS);
}

/** Cache simülatörü — eviction (LRU/LFU/FIFO), TTL ve yazma politikaları shared/cache'ten */
export function CacheSim({ params, onInteract }: SimProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const startCapacity = Math.max(2, Math.min(8, paramNumber(params, 'capacity', 4)));
  const startPolicy = paramString(params, 'policy', POLICIES, 'lru');
  const startWrite = paramString(params, 'writePolicy', WRITE_POLICIES, 'cache-aside');
  const [state, setState] = useState<CacheState>(() =>
    initialState(startCapacity, startPolicy, startWrite, 0),
  );
  const [selected, setSelected] = useState('A');
  const [lastHit, setLastHit] = useState<boolean | null>(null);
  const t0 = useRef(Date.now());
  const writeCounter = useRef(0);
  const now = () => Date.now() - t0.current;

  const read = (key: string) => {
    onInteract();
    setSelected(key);
    const res = cacheGet(state, key, now());
    setState(res.state);
    setLastHit(res.hit);
  };

  const write = () => {
    onInteract();
    writeCounter.current += 1;
    setState(cacheSet(state, selected, `v${writeCounter.current}(${selected})`, now()));
    setLastHit(null);
  };

  const ratio = hitRatio(state);
  const events = state.events.slice(-5).reverse();

  return (
    <View style={{ gap: spacing.md }} testID="sim-cache">
      <SegmentedControl
        label={t('sim.eviction')}
        value={state.policy}
        onChange={(policy) => setState((s) => ({ ...s, policy }))}
        options={POLICIES.map((p) => ({ value: p, label: p.toUpperCase() }))}
      />
      <SegmentedControl
        label={t('sim.writePolicy')}
        wrap
        value={state.writePolicy}
        onChange={(writePolicy) => setState((s) => ({ ...s, writePolicy }))}
        options={WRITE_POLICIES.map((p) => ({ value: p, label: p }))}
      />
      <Stepper
        label={t('sim.capacity')}
        value={state.capacity}
        min={2}
        max={8}
        onChange={(capacity) => setState((s) => ({ ...s, capacity }))}
      />
      <Stepper
        label={t('sim.ttl')}
        value={state.defaultTtlMs}
        min={0}
        max={10000}
        step={1000}
        onChange={(defaultTtlMs) => setState((s) => ({ ...s, defaultTtlMs }))}
        format={(v) => (v === 0 ? '∞' : `${v / 1000}s`)}
      />

      <Text variant="label">{t('sim.key')}</Text>
      <View style={styles.keys}>
        {KEYS.map((k) => {
          const cached = state.entries.some((e) => e.key === k);
          const isSel = k === selected;
          return (
            <Button
              key={k}
              compact
              title={k}
              variant={isSel ? 'primary' : 'secondary'}
              accessibilityLabel={`${t('sim.read')} ${k}`}
              onPress={() => read(k)}
              style={cached && !isSel ? { borderColor: colors.success } : undefined}
              testID={`cache-key-${k}`}
            />
          );
        })}
      </View>
      <Row wrap>
        <Button
          compact
          title={`${t('sim.read')} ${selected}`}
          icon="download-outline"
          onPress={() => read(selected)}
        />
        <Button
          compact
          variant="secondary"
          title={`${t('sim.write')} ${selected}`}
          icon="create-outline"
          onPress={write}
        />
        {state.writePolicy === 'write-back' ? (
          <Button
            compact
            variant="secondary"
            title={t('sim.flush')}
            icon="save-outline"
            onPress={() => setState(cacheFlush(state))}
          />
        ) : null}
      </Row>
      {lastHit !== null ? (
        <Text
          variant="label"
          color={lastHit ? colors.success : colors.warning}
          accessibilityLiveRegion="polite"
        >
          {lastHit ? 'HIT' : 'MISS'}
        </Text>
      ) : null}

      <Text variant="label">
        {t('sim.entries')} ({state.entries.length}/{state.capacity})
      </Text>
      <View style={styles.entries}>
        {Array.from({ length: state.capacity }).map((_, i) => {
          const e = state.entries[i];
          return (
            <View
              key={i}
              style={[
                styles.slot,
                {
                  borderColor: e ? (e.dirty ? colors.warning : colors.primary) : colors.border,
                  backgroundColor: e ? withAlpha(colors.primary, 0.08) : colors.elevated,
                },
              ]}
            >
              <Text variant="label">{e ? e.key : '—'}</Text>
              {e ? (
                <Text variant="caption" muted>
                  {e.hits} hit{e.dirty ? ' · dirty' : ''}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text variant="caption">
        {t('sim.hitRatio')}: {(ratio * 100).toFixed(0)}%
      </Text>
      <ProgressBar value={ratio} color={colors.success} height={8} label={t('sim.hitRatio')} />
      <StatRow>
        <Stat label="HIT" value={String(state.hits)} color={colors.success} />
        <Stat label="MISS" value={String(state.misses)} color={colors.warning} />
        <Stat label={t('sim.dbOps')} value={`${state.dbReads}/${state.dbWrites}`} />
      </StatRow>
      <Text variant="label">{t('sim.log')}</Text>
      {events.map((ev) => (
        <Text key={ev.seq} variant="caption" muted numberOfLines={2}>
          {ev.op.toUpperCase()} {ev.key}: {ev.detail}
        </Text>
      ))}
      <Button
        compact
        variant="ghost"
        title={t('sim.reset')}
        icon="refresh"
        onPress={() => {
          setState(
            initialState(state.capacity, state.policy, state.writePolicy, state.defaultTtlMs),
          );
          setLastHit(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  entries: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    width: 64,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
