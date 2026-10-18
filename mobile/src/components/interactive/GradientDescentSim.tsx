import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { closedFormSolution, generateLinearData, gradientStep, mseLoss, type GdStep } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { Button, Row, SegmentedControl, Text } from '@/components/ui';
import { Stat, StatRow, paramNumber, useInterval, type SimProps } from './common';

const RATES = [0.001, 0.01, 0.05, 0.1, 0.3];
const X_RANGE: [number, number] = [-5, 5];

/** Gradient descent — lineer regresyon (y = w·x + b), MSE kaybı; mantık shared/gradientDescent'ten */
export function GradientDescentSim({ params, onInteract }: SimProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const data = useMemo(() => generateLinearData(30, paramNumber(params, 'trueW', 2), paramNumber(params, 'trueB', 1), paramNumber(params, 'noise', 1), 42), [params]);
  const target = useMemo(() => closedFormSolution(data), [data]);
  const initialRate = RATES.reduce((best, r) => (Math.abs(r - paramNumber(params, 'learningRate', 0.05)) < Math.abs(best - paramNumber(params, 'learningRate', 0.05)) ? r : best), RATES[2]);
  const [lr, setLr] = useState(initialRate);
  const start: GdStep = useMemo(() => ({ iteration: 0, params: { w: 0, b: 0 }, loss: mseLoss(data, { w: 0, b: 0 }), gradW: 0, gradB: 0 }), [data]);
  const [history, setHistory] = useState<GdStep[]>([start]);
  const [running, setRunning] = useState(false);
  const [width, setWidth] = useState(0);

  const current = history[history.length - 1];
  const diverged = !Number.isFinite(current.loss) || current.loss > 1e6;

  const step = (n = 1) => {
    onInteract();
    setHistory((h) => {
      let out = h;
      for (let i = 0; i < n; i++) {
        const last = out[out.length - 1];
        if (!Number.isFinite(last.loss) || last.loss > 1e6) break;
        out = [...out, gradientStep(data, last.params, lr, last.iteration)];
      }
      return out.slice(-200);
    });
  };

  useInterval(() => {
    if (diverged || current.iteration >= 300) setRunning(false);
    else step(1);
  }, running ? 80 : null);

  const reset = () => {
    setRunning(false);
    setHistory([start]);
  };

  // Çizim ölçekleri
  const w = width;
  const h = Math.round(width * 0.6);
  const ys = data.map((d) => d.y);
  const yMin = Math.min(...ys) - 1;
  const yMax = Math.max(...ys) + 1;
  const sx = (x: number) => ((x - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * w;
  const sy = (y: number) => h - ((y - yMin) / (yMax - yMin)) * h;
  const lineY = (p: { w: number; b: number }, x: number) => Math.max(yMin - 50, Math.min(yMax + 50, p.w * x + p.b));

  const lossH = 80;
  const losses = history.map((s) => s.loss).filter((l) => Number.isFinite(l));
  const maxLoss = Math.max(...losses, 1);
  const lossPoints = history
    .filter((s) => Number.isFinite(s.loss))
    .map((s, i, arr) => `${(i / Math.max(1, arr.length - 1)) * w},${lossH - (Math.min(s.loss, maxLoss) / maxLoss) * (lossH - 4)}`)
    .join(' ');

  return (
    <View style={{ gap: spacing.md }} testID="sim-gradient-descent">
      <SegmentedControl label={t('sim.learningRate')} value={lr} onChange={(v) => { setLr(v); reset(); }} options={RATES.map((r) => ({ value: r, label: String(r) }))} />
      <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
        {w > 0 ? (
          <Svg width={w} height={h} accessibilityLabel={`w=${current.params.w.toFixed(2)}, b=${current.params.b.toFixed(2)}`}>
            <Rect x={0} y={0} width={w} height={h} fill={colors.elevated} rx={8} />
            <Line x1={sx(0)} y1={0} x2={sx(0)} y2={h} stroke={colors.border} />
            <Line x1={0} y1={sy(0)} x2={w} y2={sy(0)} stroke={colors.border} />
            {data.map((d, i) => (
              <Circle key={i} cx={sx(d.x)} cy={sy(d.y)} r={3.5} fill={colors.primary} opacity={0.75} />
            ))}
            <Line x1={sx(X_RANGE[0])} y1={sy(lineY(target, X_RANGE[0]))} x2={sx(X_RANGE[1])} y2={sy(lineY(target, X_RANGE[1]))} stroke={colors.success} strokeDasharray="6 4" strokeWidth={2} />
            {!diverged ? (
              <Line x1={sx(X_RANGE[0])} y1={sy(lineY(current.params, X_RANGE[0]))} x2={sx(X_RANGE[1])} y2={sy(lineY(current.params, X_RANGE[1]))} stroke={colors.accent} strokeWidth={3} />
            ) : null}
          </Svg>
        ) : null}
      </View>
      <Text variant="caption" muted>
        — {t('sim.target')}: w={target.w.toFixed(2)}, b={target.b.toFixed(2)}
      </Text>

      <Row wrap>
        <Button compact title={t('sim.step')} icon="footsteps" onPress={() => step(1)} disabled={diverged} testID="gd-step" />
        <Button compact variant={running ? 'danger' : 'secondary'} title={running ? t('sim.stop') : t('sim.run')} icon={running ? 'stop' : 'play'} onPress={() => { onInteract(); setRunning((r) => !r); }} disabled={diverged} />
        <Button compact variant="ghost" title={t('sim.reset')} icon="refresh" onPress={reset} />
      </Row>
      {diverged ? (
        <Text variant="label" color={colors.danger} accessibilityLiveRegion="polite">
          {t('sim.diverged')}
        </Text>
      ) : null}
      <StatRow>
        <Stat label={t('sim.iteration')} value={String(current.iteration)} />
        <Stat label={t('sim.loss')} value={Number.isFinite(current.loss) ? current.loss.toFixed(3) : '∞'} />
        <Stat label="w / b" value={`${current.params.w.toFixed(2)} / ${current.params.b.toFixed(2)}`} />
      </StatRow>
      {w > 0 && history.length > 1 ? (
        <Svg width={w} height={lossH} accessibilityLabel={t('sim.loss')}>
          <Rect x={0} y={0} width={w} height={lossH} fill={colors.elevated} rx={8} />
          <Polyline points={lossPoints} fill="none" stroke={colors.danger} strokeWidth={2} />
        </Svg>
      ) : null}
    </View>
  );
}
