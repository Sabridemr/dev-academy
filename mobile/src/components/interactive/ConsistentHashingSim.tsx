import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import {
  RING_SIZE,
  addRingNode,
  createRing,
  generateKeys,
  locateKey,
  modHashMoved,
  movedKeys,
  removeRingNode,
  ringDistribution,
  type HashRing,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { Button, ProgressBar, Row, Stepper, Text } from '@/components/ui';
import { SIM_PALETTE, Stat, StatRow, paramNumber, type SimProps } from './common';

const NODE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const KEYS = generateKeys(40);

/** Consistent hashing halkası — sanal düğümler ve taşınan anahtar oranı (mod-N ile kıyas) */
export function ConsistentHashingSim({ params, onInteract }: SimProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const startNodes = Math.max(2, Math.min(6, paramNumber(params, 'nodes', 3)));
  const startVnodes = Math.max(1, Math.min(10, paramNumber(params, 'vnodes', paramNumber(params, 'virtualNodes', 3))));
  const [ring, setRing] = useState<HashRing>(() => createRing(NODE_NAMES.slice(0, startNodes), startVnodes));
  const [lastChange, setLastChange] = useState<{ moved: number; mod: number } | null>(null);
  const [width, setWidth] = useState(0);

  const change = (next: HashRing) => {
    onInteract();
    const moved = movedKeys(ring, next, KEYS);
    const mod = modHashMoved(ring.nodes, next.nodes, KEYS);
    setLastChange(next.virtualNodes === ring.virtualNodes ? { moved: moved.ratio, mod: mod.ratio } : null);
    setRing(next);
  };

  const colorOf = (nodeId: string) => SIM_PALETTE[NODE_NAMES.indexOf(nodeId) % SIM_PALETTE.length];
  const dist = useMemo(() => ringDistribution(ring, KEYS), [ring]);
  const size = Math.min(width, 320);
  const cx = size / 2;
  const r = size / 2 - 28;
  const pos = (deg: number, radius: number) => {
    const a = ((deg / RING_SIZE) * 360 - 90) * (Math.PI / 180);
    return { x: cx + Math.cos(a) * radius, y: cx + Math.sin(a) * radius };
  };

  return (
    <View style={{ gap: spacing.md }} testID="sim-consistent-hashing">
      <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ alignItems: 'center' }}>
        {size > 0 ? (
          <Svg width={size} height={size} accessibilityLabel={`${t('sim.nodes')}: ${ring.nodes.join(', ')}`}>
            <Circle cx={cx} cy={cx} r={r} stroke={colors.border} strokeWidth={2} fill="none" />
            {KEYS.map((k) => {
              const loc = locateKey(ring, k);
              const p = pos(loc.position, r - 14);
              return <Circle key={k} cx={p.x} cy={p.y} r={3} fill={loc.owner ? colorOf(loc.owner) : colors.muted} opacity={0.8} />;
            })}
            {ring.points.map((pt) => {
              const p = pos(pt.position, r);
              const lp = pos(pt.position, r + 16);
              return (
                <G key={`${pt.nodeId}-${pt.vnodeIndex}`}>
                  <Line x1={cx} y1={cx} x2={p.x} y2={p.y} stroke={colorOf(pt.nodeId)} strokeOpacity={0.15} />
                  <Circle cx={p.x} cy={p.y} r={7} fill={colorOf(pt.nodeId)} stroke={colors.surface} strokeWidth={2} />
                  <SvgText x={lp.x} y={lp.y + 4} fontSize={10} fontWeight="700" textAnchor="middle" fill={colors.fg}>
                    {`${pt.nodeId}${pt.vnodeIndex}`}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>

      <Row wrap>
        <Button compact title={t('sim.addNode')} icon="add-circle-outline" disabled={ring.nodes.length >= NODE_NAMES.length} onPress={() => change(addRingNode(ring, NODE_NAMES.find((n) => !ring.nodes.includes(n))!))} testID="ch-add" />
        <Button compact variant="secondary" title={t('sim.removeNode')} icon="remove-circle-outline" disabled={ring.nodes.length <= 1} onPress={() => change(removeRingNode(ring, ring.nodes[ring.nodes.length - 1]))} />
      </Row>
      <Stepper label={t('sim.vnodes')} value={ring.virtualNodes} min={1} max={10} onChange={(v) => change(createRing(ring.nodes, v))} />

      <Text variant="label">
        {t('sim.distribution')} ({KEYS.length} {t('sim.keys').toLowerCase()})
      </Text>
      {ring.nodes.map((n) => (
        <Row key={n}>
          <Text variant="caption" style={{ width: 20 }} color={colorOf(n)} weight="700">
            {n}
          </Text>
          <View style={{ flex: 1 }}>
            <ProgressBar value={(dist[n] ?? 0) / KEYS.length} color={colorOf(n)} height={8} />
          </View>
          <Text variant="caption" style={{ width: 28, textAlign: 'right' }}>
            {dist[n] ?? 0}
          </Text>
        </Row>
      ))}
      {lastChange ? (
        <StatRow>
          <Stat label={t('sim.moved')} value={`${Math.round(lastChange.moved * 100)}%`} color={colors.success} />
          <Stat label={t('sim.modMoved')} value={`${Math.round(lastChange.mod * 100)}%`} color={colors.danger} />
        </StatRow>
      ) : null}
      <Button compact variant="ghost" title={t('sim.reset')} icon="refresh" onPress={() => { setRing(createRing(NODE_NAMES.slice(0, startNodes), startVnodes)); setLastChange(null); }} />
    </View>
  );
}
