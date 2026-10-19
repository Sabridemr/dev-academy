import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  changedTraceObjects,
  changedTraceVars,
  previousTraceLine,
  traceHue,
  type LessonBlock,
  type TraceHeapObject,
  type TraceValue,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Button, IconButton, MONO_FONT, Text } from '@/components/ui';
import { tokenize, type TokenKind } from '@/utils/highlight';

type TraceBlock = Extract<LessonBlock, { type: 'trace' }>;

const hueColor = (id: number, light = 42) => `hsl(${traceHue(id)}, 70%, ${light}%)`;

/** `kod` parçalarını eş aralıklı gösterir */
function InlineCode({ text, muted }: { text: string; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text variant={muted ? 'caption' : 'body'} muted={muted}>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
          <Text key={i} variant="mono" style={{ backgroundColor: colors.elevated }}>
            {part.slice(1, -1)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** Basit değer metin olarak, referans nesnenin rengini taşıyan #id rozeti olarak */
function Value({ value }: { value: TraceValue }) {
  const { scheme } = useTheme();
  if (value.t === 'prim') {
    return (
      <Text
        variant="mono"
        color={value.type === 'str' ? (scheme === 'dark' ? '#86EFAC' : '#047857') : undefined}
      >
        {value.repr}
      </Text>
    );
  }
  return (
    <View
      style={[styles.ref, { borderColor: hueColor(value.id, 50) }]}
      accessibilityLabel={`→ #${value.id}`}
    >
      <View style={[styles.dot, { backgroundColor: hueColor(value.id, 50) }]} />
      <Text variant="caption" color={hueColor(value.id)} style={{ fontFamily: MONO_FONT }}>
        #{value.id}
      </Text>
    </View>
  );
}

function Fields({ rows }: { rows: [string | TraceValue, TraceValue][] }) {
  const { colors } = useTheme();
  return (
    <View>
      {rows.map(([k, v], i) => (
        <View
          key={i}
          style={[
            styles.field,
            i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
          ]}
        >
          {typeof k === 'string' ? (
            <Text variant="mono" muted>
              {k}
            </Text>
          ) : (
            <Value value={k} />
          )}
          <Value value={v} />
        </View>
      ))}
    </View>
  );
}

function HeapObject({ obj, changed }: { obj: TraceHeapObject; changed: boolean }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const label =
    obj.kind === 'instance'
      ? t('trace.instanceOf', { name: obj.type })
      : obj.kind === 'class'
        ? `class ${obj.repr ?? obj.type}`
        : obj.kind === 'function'
          ? 'function'
          : obj.type;
  return (
    <View
      style={[
        styles.object,
        {
          borderColor: changed ? colors.warning : hueColor(obj.id, 70),
          borderWidth: changed ? 2 : 1,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={styles.objectHead}>
        <Text variant="caption" muted weight="600">
          {label}
        </Text>
        <Text variant="caption" color={hueColor(obj.id)} style={{ fontFamily: MONO_FONT }}>
          #{obj.id}
        </Text>
      </View>
      {obj.kind === 'prim' || obj.kind === 'other' ? (
        <Text variant="mono">{obj.repr}</Text>
      ) : obj.kind === 'function' ? (
        <>
          <Text variant="mono">{obj.repr}</Text>
          {obj.attrs?.length ? <Fields rows={obj.attrs} /> : null}
        </>
      ) : obj.kind === 'list' || obj.kind === 'tuple' || obj.kind === 'set' ? (
        obj.items?.length ? (
          <View style={styles.cells}>
            {obj.items.map((v, i) => (
              <View key={i} style={[styles.cell, { borderColor: colors.border }]}>
                {obj.kind !== 'set' ? (
                  <Text variant="caption" muted style={{ fontSize: 9, lineHeight: 11 }}>
                    {i}
                  </Text>
                ) : null}
                <Value value={v} />
              </View>
            ))}
          </View>
        ) : (
          <Text variant="mono" muted>
            {obj.kind === 'list' ? '[]' : obj.kind === 'tuple' ? '()' : 'set()'}
          </Text>
        )
      ) : obj.kind === 'dict' ? (
        obj.entries?.length ? (
          <Fields rows={obj.entries} />
        ) : (
          <Text variant="mono" muted>
            {'{}'}
          </Text>
        )
      ) : obj.attrs?.length ? (
        <Fields rows={obj.attrs} />
      ) : (
        <Text variant="caption" muted>
          —
        </Text>
      )}
    </View>
  );
}

/**
 * Kod izi oynatıcısı (mobil): kod, çağrı yığını, heap ve çıktı alt alta. Ok çizilmez; değişkenin
 * #id rozeti ile heap nesnesinin rozeti aynı renktedir.
 */
export function TraceView({ block }: { block: TraceBlock }) {
  const { t, tl } = useI18n();
  const { colors, scheme } = useTheme();
  const trace = block.trace;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lines = useMemo(() => (trace ? tokenize(trace.code, 'python') : []), [trace]);
  const total = trace?.steps.length ?? 0;

  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), 1000);
    return () => clearTimeout(timer);
  }, [playing, index, total]);

  if (!trace) return null;
  const step = trace.steps[index];
  const prev = index > 0 ? trace.steps[index - 1] : undefined;
  const changedObjects = changedTraceObjects(prev, step);
  const changedVars = changedTraceVars(prev, step);
  const justRan = previousTraceLine(trace.steps, index);
  const top = step.frames[step.frames.length - 1];
  const failed = step.event === 'exception' || Boolean(step.exception);
  const go = (i: number) => setIndex(Math.max(0, Math.min(total - 1, i)));

  const tokenColor: Record<TokenKind, string> = {
    plain: colors.fg,
    keyword: colors.primary,
    string: scheme === 'dark' ? '#86EFAC' : '#047857',
    number: colors.accent,
    comment: colors.muted,
    type: scheme === 'dark' ? '#F0ABFC' : '#A21CAF',
  };

  const status =
    step.event === 'call'
      ? t('trace.event.call', { name: top.name })
      : step.event === 'return'
        ? t('trace.event.return', { name: top.name })
        : step.event === 'exception'
          ? t('trace.event.exception')
          : step.event === 'end'
            ? step.exception
              ? t('trace.event.crashed')
              : t('trace.event.end')
            : t('trace.event.line', { line: step.line });

  return (
    <View style={[styles.root, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="label">{block.title ? tl(block.title) : t('trace.role')}</Text>
        <Text variant="caption" muted>
          {t('trace.hint')}
        </Text>
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.code}
        style={{ backgroundColor: colors.elevated }}
      >
        <View>
          {lines.map((tokens, li) => {
            const n = li + 1;
            const current = n === step.line;
            return (
              <View
                key={n}
                style={[
                  styles.line,
                  current && {
                    backgroundColor: withAlpha(failed ? colors.danger : colors.success, 0.14),
                  },
                ]}
              >
                <Text
                  variant="mono"
                  color={current ? (failed ? colors.danger : colors.success) : colors.muted}
                  style={styles.arrow}
                >
                  {current || n === justRan ? '➜' : ' '}
                </Text>
                <Text variant="mono" color={colors.muted} style={styles.lineNo}>
                  {String(n).padStart(2, ' ')}
                </Text>
                <Text variant="mono">
                  {tokens.length === 0
                    ? ' '
                    : tokens.map((tok, ti) => (
                        <Text key={ti} variant="mono" color={tokenColor[tok.kind]}>
                          {tok.text}
                        </Text>
                      ))}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={[styles.status, { backgroundColor: withAlpha(colors.primary, 0.06) }]}
        accessibilityLiveRegion="polite"
      >
        <Text variant="caption" weight="600" color={failed ? colors.danger : colors.primary}>
          {status}
          {step.exception ? ` — ${step.exception}` : ''}
        </Text>
        {step.note ? <InlineCode text={tl(step.note)} /> : null}
      </View>

      <View style={styles.controls}>
        <IconButton
          icon="play-skip-back"
          label={t('trace.first')}
          onPress={() => go(0)}
          disabled={index === 0}
        />
        <IconButton
          icon="chevron-back"
          label={t('player.stepBack')}
          onPress={() => go(index - 1)}
          disabled={index === 0}
        />
        <Button
          title={playing ? t('player.pause') : t('player.play')}
          icon={playing ? 'pause' : 'play'}
          compact
          onPress={() => {
            if (index >= total - 1) setIndex(0);
            setPlaying((p) => !p);
          }}
        />
        <IconButton
          icon="chevron-forward"
          label={t('player.stepForward')}
          onPress={() => go(index + 1)}
          disabled={index === total - 1}
        />
        <IconButton
          icon="play-skip-forward"
          label={t('trace.last')}
          onPress={() => go(total - 1)}
          disabled={index === total - 1}
        />
        <Text variant="caption" muted style={{ marginLeft: 'auto', fontFamily: MONO_FONT }}>
          {index + 1}/{total}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="caption" muted weight="600">
          {t('trace.frames').toUpperCase()}
        </Text>
        {step.frames.map((f, fi) => {
          const active = fi === step.frames.length - 1;
          return (
            <View
              key={f.id}
              style={[
                styles.frame,
                {
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? withAlpha(colors.primary, 0.06) : colors.surface,
                },
              ]}
            >
              <Text variant="mono" weight="700">
                {f.name === 'Global' ? t('trace.global') : f.name}
              </Text>
              {f.locals.length === 0 ? (
                <Text variant="caption" muted>
                  {t('trace.noVars')}
                </Text>
              ) : (
                f.locals.map(([name, v]) => (
                  <View
                    key={name}
                    style={[
                      styles.field,
                      changedVars.has(`${f.id}:${name}`) && {
                        backgroundColor: withAlpha(colors.warning, 0.18),
                      },
                    ]}
                  >
                    <Text variant="mono">{name}</Text>
                    <Value value={v} />
                  </View>
                ))
              )}
              {active && step.event === 'return' && step.returnValue ? (
                <View style={styles.field}>
                  <Text variant="caption" muted>
                    {t('trace.returns')}
                  </Text>
                  <Value value={step.returnValue} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text variant="caption" muted weight="600">
          {t('trace.heap').toUpperCase()}
        </Text>
        {step.heap.length === 0 ? (
          <Text variant="caption" muted>
            {t('trace.noObjects')}
          </Text>
        ) : (
          <View style={styles.heap}>
            {step.heap.map((o) => (
              <HeapObject key={o.id} obj={o} changed={changedObjects.has(o.id)} />
            ))}
          </View>
        )}
      </View>

      <View
        style={[
          styles.section,
          { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        ]}
      >
        <Text variant="caption" muted weight="600">
          {t('trace.output').toUpperCase()}
        </Text>
        <Text variant="mono" selectable>
          {step.stdout}
          {step.event === 'end' && step.exception ? (
            <Text variant="mono" color={colors.danger}>
              {`Traceback …\n${step.exception}`}
            </Text>
          ) : null}
        </Text>
      </View>

      {block.caption ? (
        <View
          style={[
            styles.section,
            { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <InlineCode text={tl(block.caption)} muted />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  header: { padding: spacing.md, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  code: { paddingVertical: spacing.sm, paddingRight: spacing.md },
  line: { flexDirection: 'row' },
  arrow: { width: 22, textAlign: 'center' },
  lineNo: { width: 26, opacity: 0.7, marginRight: spacing.sm },
  status: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  section: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  frame: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 2,
  },
  heap: { gap: spacing.sm, alignItems: 'flex-start' },
  object: { borderRadius: radius.md, padding: spacing.sm, gap: 4, maxWidth: '100%' },
  objectHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  cells: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    minWidth: 30,
  },
  ref: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
