import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import {
  LB_ALGORITHMS,
  addServer,
  completeRequest,
  createLbState,
  distributionStats,
  removeServer,
  routeRequest,
  setServerHealth,
  setServerWeight,
  type LbAlgorithm,
  type LbState,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, ProgressBar, Row, SegmentedControl, Stepper, Text } from '@/components/ui';
import {
  SIM_PALETTE,
  Stat,
  StatRow,
  paramNumber,
  paramString,
  useInterval,
  type SimProps,
} from './common';

const CLIENT_IPS = [
  '10.0.0.11',
  '10.0.0.27',
  '192.168.1.4',
  '172.16.0.9',
  '10.0.0.42',
  '192.168.1.77',
];
const ALGOS = LB_ALGORITHMS.map((a) => a.id);

/** Yük dengeleyici simülatörü — yönlendirme kararları shared/loadBalancer saf fonksiyonlarından */
export function LoadBalancerSim({ params, onInteract }: SimProps) {
  const { t, tl } = useI18n();
  const { colors } = useTheme();
  const initialAlgo = paramString<LbAlgorithm>(params, 'algorithm', ALGOS, 'round-robin');
  const initialServers = Math.max(1, Math.min(6, paramNumber(params, 'servers', 3)));
  const [state, setStateRaw] = useState<LbState>(() => createLbState(initialAlgo, initialServers));
  const stateRef = useRef(state);
  const [auto, setAuto] = useState(false);
  const reqId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Tüm durum değişiklikleri buradan geçer (ref + state senkron kalır) */
  const setState = (fn: (s: LbState) => LbState) => {
    stateRef.current = fn(stateRef.current);
    setStateRaw(stateRef.current);
  };

  const send = (count = 1) => {
    onInteract();
    for (let i = 0; i < count; i++) {
      reqId.current += 1;
      const ip = CLIENT_IPS[Math.floor(Math.random() * CLIENT_IPS.length)];
      const next = routeRequest(stateRef.current, {
        id: reqId.current,
        clientIp: ip,
        sessionId: ip,
      });
      setState(() => next);
      const serverId = next.log[next.log.length - 1]?.serverId;
      if (serverId) {
        const latency = 600 + Math.random() * 900;
        timers.current.push(
          setTimeout(() => setState((cur) => completeRequest(cur, serverId)), latency),
        );
      }
    }
  };

  useInterval(() => send(1), auto ? 350 : null);

  const stats = distributionStats(state);
  const lastLogs = state.log.slice(-5).reverse();

  return (
    <View style={{ gap: spacing.md }} testID="sim-load-balancer">
      <SegmentedControl
        label={t('sim.algorithm')}
        wrap
        value={state.algorithm}
        onChange={(algorithm) => setState((s) => ({ ...s, algorithm, rrIndex: 0 }))}
        options={LB_ALGORITHMS.map((a) => ({ value: a.id, label: tl(a.label) }))}
      />
      <Row wrap>
        <Button
          compact
          title={t('sim.send')}
          icon="paper-plane"
          onPress={() => send(1)}
          testID="lb-send"
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
      <Row wrap>
        <Button
          compact
          variant="ghost"
          title={t('sim.addServer')}
          icon="add-circle-outline"
          onPress={() => setState((s) => (s.servers.length < 8 ? addServer(s) : s))}
        />
        <Button
          compact
          variant="ghost"
          title={t('sim.removeServer')}
          icon="remove-circle-outline"
          onPress={() => setState((s) => removeServer(s))}
        />
        <Row>
          <Text variant="caption">{t('sim.sticky')}</Text>
          <Switch
            value={state.stickySessions}
            onValueChange={(v) => setState((s) => ({ ...s, stickySessions: v, stickyTable: {} }))}
            accessibilityLabel={t('sim.sticky')}
          />
        </Row>
      </Row>

      <View style={styles.servers}>
        {state.servers.map((srv, i) => {
          const color = SIM_PALETTE[i % SIM_PALETTE.length];
          return (
            <View
              key={srv.id}
              style={[
                styles.server,
                {
                  borderColor: srv.healthy ? color : colors.danger,
                  backgroundColor: withAlpha(srv.healthy ? color : colors.danger, 0.08),
                },
              ]}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="label">{srv.id}</Text>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: srv.healthy }}
                  accessibilityLabel={`${srv.id}: ${srv.healthy ? t('sim.healthy') : t('sim.down')}`}
                  onPress={() => setState((s) => setServerHealth(s, srv.id, !srv.healthy))}
                >
                  <Text
                    variant="caption"
                    weight="700"
                    color={srv.healthy ? colors.success : colors.danger}
                  >
                    {srv.healthy ? t('sim.healthy') : t('sim.down')}
                  </Text>
                </Pressable>
              </Row>
              <Text variant="caption" muted>
                {srv.served} req · {srv.activeConnections} conn
              </Text>
              <ProgressBar value={Math.min(1, srv.activeConnections / 6)} color={color} />
              {state.algorithm === 'weighted-round-robin' ||
              state.algorithm === 'least-connections' ? (
                <Stepper
                  label={t('sim.weight')}
                  value={srv.weight}
                  min={1}
                  max={5}
                  onChange={(w) => setState((s) => setServerWeight(s, srv.id, w))}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      <Text variant="label">{t('sim.distribution')}</Text>
      {state.servers.map((srv, i) => (
        <Row key={srv.id}>
          <Text variant="caption" style={{ width: 28 }}>
            {srv.id}
          </Text>
          <View style={{ flex: 1 }}>
            <ProgressBar
              value={(stats.perServer[srv.id] ?? 0) / 100}
              color={SIM_PALETTE[i % SIM_PALETTE.length]}
              height={8}
            />
          </View>
          <Text variant="caption" style={{ width: 44, textAlign: 'right' }}>
            {Math.round(stats.perServer[srv.id] ?? 0)}%
          </Text>
        </Row>
      ))}
      <StatRow>
        <Stat label={t('sim.imbalance')} value={stats.stdDev.toFixed(1)} />
        <Stat
          label={t('sim.rejected')}
          value={String(state.rejected)}
          color={state.rejected ? colors.danger : undefined}
        />
      </StatRow>

      <Text variant="label">{t('sim.log')}</Text>
      {lastLogs.map((l) => (
        <Text key={l.requestId} variant="caption" muted numberOfLines={1}>
          #{l.requestId} {l.clientIp} → {l.reason}
        </Text>
      ))}
      <Button
        compact
        variant="ghost"
        title={t('sim.reset')}
        icon="refresh"
        onPress={() => {
          setAuto(false);
          setState(() => createLbState(stateRef.current.algorithm, initialServers));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  servers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  server: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
});
