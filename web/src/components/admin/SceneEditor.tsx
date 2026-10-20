'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Rocket, Save, Trash2 } from 'lucide-react';
import {
  AnimationSceneSchema,
  NodeKindSchema,
  validateScene,
  resolveStepView,
  type AnimationSceneInput,
  type SceneValidationIssue,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ScenePlayer } from '../scene/ScenePlayer';
import { SceneCanvas } from '../scene/SceneCanvas';

type Tab = 'visual' | 'json';
type NodeInput = AnimationSceneInput['nodes'][number];
type StepInput = AnimationSceneInput['steps'][number];

/**
 * Animasyon sahnesi editörü.
 *  - Görsel sekme: tuval üzerinde düğümleri sürükle-bırak konumlandır, düğüm/kenar ekle, adımları düzenle
 *    (vurgular, düğüm durumları, paketler), seçili adımı statik olarak gör.
 *  - JSON sekmesi: tam sahne JSON'u.
 *  - Her değişiklikte shared validateScene ile doğrulama; geçerliyse canlı oynatıcı önizlemesi.
 */
export function SceneEditor({
  initial,
  lessonId: initialLessonId,
}: {
  initial: AnimationSceneInput;
  lessonId?: string;
}) {
  const { t, tl } = useI18n();
  const router = useRouter();
  const [scene, setScene] = useState<AnimationSceneInput>(initial);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initial, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('visual');
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState(initialLessonId ?? '');
  const [status, setStatus] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);

  const validation = useMemo(() => validateScene(scene), [scene]);
  const errors = validation.issues.filter((i) => i.severity === 'error');
  const warnings = validation.issues.filter((i) => i.severity === 'warning');

  const update = (next: AnimationSceneInput) => {
    setScene(next);
    setJsonText(JSON.stringify(next, null, 2));
  };

  const onJsonChange = (text: string) => {
    setJsonText(text);
    try {
      // Geçerli JSON ama yanlış yapı (ör. `{}`) önizlemeyi çökertmesin: şemadan geçmeyen girdi uygulanmaz
      const parsed = AnimationSceneSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        setJsonError(
          parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.') || '(kök)'}: ${i.message}`)
            .join('; '),
        );
        return;
      }
      setScene(JSON.parse(text) as AnimationSceneInput);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  /* ------------------------- Düğüm sürükleme ------------------------- */
  const toSceneCoords = (clientX: number, clientY: number) => {
    const svg = canvasRef.current?.querySelector('svg');
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return { x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = toSceneCoords(e.clientX, e.clientY);
    if (!p) return;
    const id = dragging.current;
    update({
      ...scene,
      nodes: scene.nodes.map((n) => (n.id === id ? { ...n, x: p.x, y: p.y } : n)),
    });
  };

  /* --------------------------- Düzenleyiciler ------------------------ */
  const node = scene.nodes.find((n) => n.id === selectedNode);
  const step = scene.steps[stepIndex];
  const setNode = (patch: Partial<NodeInput>) =>
    update({
      ...scene,
      nodes: scene.nodes.map((n) => (n.id === selectedNode ? { ...n, ...patch } : n)),
    });
  const setStep = (patch: Partial<StepInput>) =>
    update({
      ...scene,
      steps: scene.steps.map((s, i) => (i === stepIndex ? { ...s, ...patch } : s)),
    });

  const addNode = () => {
    const id = `node-${scene.nodes.length + 1}`;
    update({
      ...scene,
      nodes: [...scene.nodes, { id, kind: 'service', label: id, x: 500, y: 300 }],
    });
    setSelectedNode(id);
  };
  const removeNode = () => {
    if (!selectedNode) return;
    update({
      ...scene,
      nodes: scene.nodes.filter((n) => n.id !== selectedNode),
      edges: (scene.edges ?? []).filter((e) => e.from !== selectedNode && e.to !== selectedNode),
    });
    setSelectedNode(null);
  };
  const addEdge = (to: string) => {
    if (!selectedNode || selectedNode === to) return;
    const id = `${selectedNode}-${to}`;
    if ((scene.edges ?? []).some((e) => e.id === id)) return;
    update({
      ...scene,
      edges: [...(scene.edges ?? []), { id, from: selectedNode, to, kind: 'request' }],
    });
  };
  const addStep = () => {
    const id = `step-${scene.steps.length + 1}`;
    update({
      ...scene,
      steps: [
        ...scene.steps,
        {
          id,
          title: { tr: `Adım ${scene.steps.length + 1}`, en: `Step ${scene.steps.length + 1}` },
          narration: { tr: '', en: '' },
        },
      ],
    });
    setStepIndex(scene.steps.length);
  };
  const toggleHighlightNode = (id: string) => {
    const h = step.highlight ?? { nodes: [], edges: [] };
    const nodes = h.nodes ?? [];
    setStep({
      highlight: {
        nodes: nodes.includes(id) ? nodes.filter((x) => x !== id) : [...nodes, id],
        edges: h.edges ?? [],
      },
    });
  };
  const toggleHighlightEdge = (id: string) => {
    const h = step.highlight ?? { nodes: [], edges: [] };
    const edges = h.edges ?? [];
    setStep({
      highlight: {
        nodes: h.nodes ?? [],
        edges: edges.includes(id) ? edges.filter((x) => x !== id) : [...edges, id],
      },
    });
  };
  const togglePacket = (edgeId: string) => {
    const packets = step.packets ?? [];
    setStep({
      packets: packets.some((p) => p.edge === edgeId)
        ? packets.filter((p) => p.edge !== edgeId)
        : [...packets, { edge: edgeId }],
    });
  };

  /* ------------------------------ Kaydet ----------------------------- */
  const save = async (publish: boolean) => {
    setStatus(null);
    try {
      await api(`/admin/scenes${publish ? '?publish=true' : ''}`, {
        method: 'PUT',
        body: { scene, lessonId: lessonId || undefined },
      });
      setStatus({ tone: 'ok', text: publish ? t('admin.published') : t('admin.saved') });
      if (initial.id !== scene.id) router.replace(`/admin/scenes/${scene.id}`);
    } catch (e) {
      setStatus({
        tone: 'err',
        text:
          e instanceof ApiError
            ? `${e.message}: ${(e.body.details ?? []).map((d) => `${d.path} ${d.message}`).join('; ')}`
            : String(e),
      });
    }
  };

  const loc = (v: unknown, lang: 'tr' | 'en') =>
    typeof v === 'string'
      ? lang === 'tr'
        ? v
        : ''
      : ((v as { tr?: string; en?: string } | undefined)?.[lang] ?? '');
  const staticView =
    validation.ok && validation.scene
      ? resolveStepView(validation.scene, Math.min(stepIndex, validation.scene.steps.length - 1))
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.sceneEditor')}</h1>
          <p className="font-mono text-xs text-muted">{scene.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <span className={cn('text-sm', status.tone === 'ok' ? 'text-success' : 'text-danger')}>
              {status.text}
            </span>
          )}
          <input
            className="input w-56"
            placeholder="lessonId"
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost"
            disabled={!validation.ok}
            onClick={() => save(false)}
          >
            <Save size={14} /> {t('admin.save')}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!validation.ok}
            onClick={() => save(true)}
          >
            <Rocket size={14} /> {t('admin.publish')}
          </button>
        </div>
      </div>

      <div className="flex gap-1" role="tablist">
        {(['visual', 'json'] as Tab[]).map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm',
              tab === x ? 'bg-elevated font-medium' : 'text-muted',
            )}
          >
            {x === 'visual' ? t('admin.visual') : t('admin.json')}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {tab === 'visual' ? (
            <div
              ref={canvasRef}
              className="card overflow-hidden bg-bg/60 p-2"
              onPointerMove={onPointerMove}
              onPointerUp={() => (dragging.current = null)}
              onPointerLeave={() => (dragging.current = null)}
              onPointerDown={(e) => {
                const target = (e.target as Element).closest('[aria-label]');
                if (!target || !selectedNode) return;
                const hit = scene.nodes.find((n) =>
                  target
                    .getAttribute('aria-label')
                    ?.startsWith(typeof n.label === 'string' ? n.label : n.label.tr),
                );
                if (hit && hit.id === selectedNode) dragging.current = hit.id;
              }}
            >
              {staticView && validation.scene ? (
                <SceneCanvas
                  scene={validation.scene}
                  view={staticView}
                  elapsedMs={(staticView.step.durationMs ?? 2500) / 2}
                  reducedMotion
                  onNodeClick={(id) =>
                    selectedNode &&
                    selectedNode !== id &&
                    (window.event as MouseEvent | undefined)?.shiftKey
                      ? addEdge(id)
                      : setSelectedNode(id)
                  }
                  selectedNodeId={selectedNode}
                />
              ) : (
                <p className="p-8 text-center text-sm text-danger">
                  {t('admin.validation')}: {errors.length} hata
                </p>
              )}
              <p className="px-2 pb-1 text-xs text-muted">
                Düğüme tıkla → seç; seçiliyken sürükle → taşı; Shift+tıkla → seçili düğümden kenar
                ekle.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <textarea
                className="h-[560px] w-full resize-y bg-bg/60 p-3 font-mono text-xs outline-none"
                spellCheck={false}
                value={jsonText}
                onChange={(e) => onJsonChange(e.target.value)}
                aria-label="scene json"
              />
              {jsonError && <p className="px-3 pb-2 text-xs text-danger">{jsonError}</p>}
            </div>
          )}

          <ValidationPanel
            errors={errors}
            warnings={warnings}
            okLabel={t('admin.valid')}
            title={t('admin.validation')}
          />

          {validation.ok && validation.scene && (
            <div>
              <p className="label">{t('admin.preview')}</p>
              <ScenePlayer scene={validation.scene} />
            </div>
          )}
        </div>

        {/* Yan panel: sahne, düğüm, adım düzenleyicileri */}
        <aside className="space-y-4">
          <section className="card space-y-2 p-4">
            <p className="label">Scene</p>
            <input
              className="input font-mono"
              value={scene.id}
              onChange={(e) => update({ ...scene, id: e.target.value })}
            />
            <input
              className="input"
              placeholder="Title tr"
              value={loc(scene.title, 'tr')}
              onChange={(e) =>
                update({
                  ...scene,
                  title: { tr: e.target.value, en: loc(scene.title, 'en') || undefined },
                })
              }
            />
            <input
              className="input"
              placeholder="Title en"
              value={loc(scene.title, 'en')}
              onChange={(e) =>
                update({
                  ...scene,
                  title: { tr: loc(scene.title, 'tr'), en: e.target.value || undefined },
                })
              }
            />
            <textarea
              className="input"
              placeholder="a11y description (tr)"
              value={loc(scene.a11y.description, 'tr')}
              onChange={(e) =>
                update({
                  ...scene,
                  a11y: {
                    ...scene.a11y,
                    description: {
                      tr: e.target.value,
                      en: loc(scene.a11y.description, 'en') || undefined,
                    },
                  },
                })
              }
            />
          </section>

          <section className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="label">{t('admin.addNode')}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn-icon h-7 w-7"
                  onClick={addNode}
                  aria-label={t('admin.addNode')}
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  className="btn-icon h-7 w-7"
                  onClick={removeNode}
                  disabled={!node}
                  aria-label="delete node"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {scene.nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNode(n.id)}
                  className={cn('chip', selectedNode === n.id && 'border-primary text-primary')}
                >
                  {n.id}
                </button>
              ))}
            </div>
            {node && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input col-span-2 font-mono"
                  value={node.id}
                  onChange={(e) => {
                    const old = node.id;
                    const id = e.target.value;
                    update({
                      ...scene,
                      nodes: scene.nodes.map((n) => (n.id === old ? { ...n, id } : n)),
                      edges: (scene.edges ?? []).map((ed) => ({
                        ...ed,
                        from: ed.from === old ? id : ed.from,
                        to: ed.to === old ? id : ed.to,
                      })),
                    });
                    setSelectedNode(id);
                  }}
                />
                <input
                  className="input col-span-2"
                  placeholder="label tr"
                  value={loc(node.label, 'tr')}
                  onChange={(e) =>
                    setNode({
                      label: { tr: e.target.value, en: loc(node.label, 'en') || undefined },
                    })
                  }
                />
                <select
                  className="input"
                  value={node.kind ?? 'generic'}
                  onChange={(e) => setNode({ kind: e.target.value as NodeInput['kind'] })}
                >
                  {NodeKindSchema.options.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  placeholder="color"
                  value={node.color ?? ''}
                  onChange={(e) => setNode({ color: e.target.value || undefined })}
                />
                <input
                  type="number"
                  className="input"
                  value={node.x}
                  onChange={(e) => setNode({ x: Number(e.target.value) })}
                  aria-label="x"
                />
                <input
                  type="number"
                  className="input"
                  value={node.y}
                  onChange={(e) => setNode({ y: Number(e.target.value) })}
                  aria-label="y"
                />
              </div>
            )}
          </section>

          <section className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="label">{t('admin.addStep')}</p>
              <button
                type="button"
                className="btn-icon h-7 w-7"
                onClick={addStep}
                aria-label={t('admin.addStep')}
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {scene.steps.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStepIndex(i)}
                  className={cn('chip', i === stepIndex && 'border-primary text-primary')}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            {step && (
              <div className="space-y-2">
                <input
                  className="input"
                  placeholder="title tr"
                  value={loc(step.title, 'tr')}
                  onChange={(e) =>
                    setStep({
                      title: { tr: e.target.value, en: loc(step.title, 'en') || undefined },
                    })
                  }
                />
                <textarea
                  className="input min-h-[80px]"
                  placeholder="narration tr"
                  value={loc(step.narration, 'tr')}
                  onChange={(e) =>
                    setStep({
                      narration: { tr: e.target.value, en: loc(step.narration, 'en') || undefined },
                    })
                  }
                />
                <textarea
                  className="input min-h-[60px]"
                  placeholder="narration en"
                  value={loc(step.narration, 'en')}
                  onChange={(e) =>
                    setStep({
                      narration: { tr: loc(step.narration, 'tr'), en: e.target.value || undefined },
                    })
                  }
                />
                <label className="block">
                  <span className="label">durationMs</span>
                  <input
                    type="number"
                    className="input"
                    value={step.durationMs ?? 2500}
                    onChange={(e) => setStep({ durationMs: Number(e.target.value) })}
                  />
                </label>
                <p className="label">Highlight / status</p>
                <div className="space-y-1">
                  {scene.nodes.map((n) => {
                    const st = step.nodeStates?.[n.id]?.status ?? '';
                    return (
                      <div key={n.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={step.highlight?.nodes?.includes(n.id) ?? false}
                          onChange={() => toggleHighlightNode(n.id)}
                          aria-label={`highlight ${n.id}`}
                        />
                        <span className="w-24 truncate font-mono">{n.id}</span>
                        <select
                          className="flex-1 rounded border border-border bg-surface px-1 py-0.5"
                          value={st}
                          onChange={(e) =>
                            setStep({
                              nodeStates: {
                                ...(step.nodeStates ?? {}),
                                [n.id]: {
                                  ...(step.nodeStates?.[n.id] ?? {}),
                                  status: (e.target.value || undefined) as never,
                                },
                              },
                            })
                          }
                        >
                          <option value="">—</option>
                          {[
                            'idle',
                            'active',
                            'busy',
                            'success',
                            'warning',
                            'error',
                            'down',
                            'muted',
                          ].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <p className="label">Edges (highlight · packet)</p>
                <div className="space-y-1">
                  {(scene.edges ?? []).map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={step.highlight?.edges?.includes(e.id) ?? false}
                        onChange={() => toggleHighlightEdge(e.id)}
                        aria-label={`highlight ${e.id}`}
                      />
                      <input
                        type="checkbox"
                        checked={(step.packets ?? []).some((p) => p.edge === e.id)}
                        onChange={() => togglePacket(e.id)}
                        aria-label={`packet ${e.id}`}
                      />
                      <span className="font-mono">{e.id}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-ghost w-full text-danger"
                  disabled={scene.steps.length <= 1}
                  onClick={() => {
                    update({ ...scene, steps: scene.steps.filter((_, i) => i !== stepIndex) });
                    setStepIndex(Math.max(0, stepIndex - 1));
                  }}
                >
                  <Trash2 size={14} /> step
                </button>
                <p className="text-xs text-muted">
                  {tl(validation.scene?.steps[stepIndex]?.title ?? '')}
                </p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ValidationPanel({
  errors,
  warnings,
  okLabel,
  title,
}: {
  errors: SceneValidationIssue[];
  warnings: SceneValidationIssue[];
  okLabel: string;
  title: string;
}) {
  return (
    <div className="card p-3 text-xs" aria-live="polite">
      <p className="label">{title}</p>
      {errors.length === 0 && warnings.length === 0 && <p className="text-success">✓ {okLabel}</p>}
      <ul className="space-y-0.5 font-mono">
        {errors.map((e, i) => (
          <li key={`e${i}`} className="text-danger">
            ✗ {e.path}: {e.message}
          </li>
        ))}
        {warnings.map((w, i) => (
          <li key={`w${i}`} className="text-warning">
            ⚠ {w.path}: {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
