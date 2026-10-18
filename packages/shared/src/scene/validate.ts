import { AnimationSceneSchema, type AnimationScene, type AnimationSceneInput } from './schema';

export interface SceneValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SceneValidationResult {
  ok: boolean;
  scene?: AnimationScene;
  issues: SceneValidationIssue[];
}

/**
 * Şema doğrulamasının ötesinde anlamsal kontroller:
 *  - kenarlar var olan düğümlere referans vermeli
 *  - adımlardaki vurgular/durumlar/paketler var olan id'lere referans vermeli
 *  - id'ler benzersiz olmalı
 *  - parent referansları "group" türünde düğüme işaret etmeli
 */
export function validateScene(input: unknown): SceneValidationResult {
  const parsed = AnimationSceneSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        severity: 'error' as const,
      })),
    };
  }

  const scene = parsed.data;
  const issues: SceneValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  scene.nodes.forEach((n, idx) => {
    if (nodeIds.has(n.id)) {
      issues.push({ path: `nodes.${idx}.id`, message: `Tekrarlanan düğüm kimliği: ${n.id}`, severity: 'error' });
    }
    nodeIds.add(n.id);
  });

  scene.nodes.forEach((n, idx) => {
    if (n.parent) {
      const parent = scene.nodes.find((p) => p.id === n.parent);
      if (!parent) {
        issues.push({ path: `nodes.${idx}.parent`, message: `Bilinmeyen üst düğüm: ${n.parent}`, severity: 'error' });
      } else if (parent.kind !== 'group' && parent.kind !== 'region' && parent.kind !== 'zone') {
        issues.push({
          path: `nodes.${idx}.parent`,
          message: `Üst düğüm group/region/zone türünde olmalı: ${n.parent}`,
          severity: 'warning',
        });
      }
    }
    if (n.x < 0 || n.x > scene.canvas.width || n.y < 0 || n.y > scene.canvas.height) {
      issues.push({ path: `nodes.${idx}`, message: `Düğüm tuval dışında: ${n.id}`, severity: 'warning' });
    }
  });

  scene.edges.forEach((e, idx) => {
    if (edgeIds.has(e.id)) {
      issues.push({ path: `edges.${idx}.id`, message: `Tekrarlanan kenar kimliği: ${e.id}`, severity: 'error' });
    }
    edgeIds.add(e.id);
    if (!nodeIds.has(e.from)) {
      issues.push({ path: `edges.${idx}.from`, message: `Bilinmeyen düğüm: ${e.from}`, severity: 'error' });
    }
    if (!nodeIds.has(e.to)) {
      issues.push({ path: `edges.${idx}.to`, message: `Bilinmeyen düğüm: ${e.to}`, severity: 'error' });
    }
  });

  const stepIds = new Set<string>();
  scene.steps.forEach((s, idx) => {
    const base = `steps.${idx}`;
    if (stepIds.has(s.id)) {
      issues.push({ path: `${base}.id`, message: `Tekrarlanan adım kimliği: ${s.id}`, severity: 'error' });
    }
    stepIds.add(s.id);

    s.highlight.nodes.forEach((id) => {
      if (!nodeIds.has(id)) issues.push({ path: `${base}.highlight.nodes`, message: `Bilinmeyen düğüm: ${id}`, severity: 'error' });
    });
    s.highlight.edges.forEach((id) => {
      if (!edgeIds.has(id)) issues.push({ path: `${base}.highlight.edges`, message: `Bilinmeyen kenar: ${id}`, severity: 'error' });
    });
    Object.keys(s.nodeStates).forEach((id) => {
      if (!nodeIds.has(id)) issues.push({ path: `${base}.nodeStates.${id}`, message: `Bilinmeyen düğüm: ${id}`, severity: 'error' });
    });
    Object.keys(s.edgeStates).forEach((id) => {
      if (!edgeIds.has(id)) issues.push({ path: `${base}.edgeStates.${id}`, message: `Bilinmeyen kenar: ${id}`, severity: 'error' });
    });
    s.packets.forEach((p, pIdx) => {
      if (!edgeIds.has(p.edge)) {
        issues.push({ path: `${base}.packets.${pIdx}.edge`, message: `Bilinmeyen kenar: ${p.edge}`, severity: 'error' });
      }
      const total = p.startAt + p.durationMs * p.repeat + p.repeatGapMs * (p.repeat - 1);
      if (total > s.durationMs * 1.5) {
        issues.push({
          path: `${base}.packets.${pIdx}`,
          message: `Paket süresi (${total}ms) adım süresini (${s.durationMs}ms) belirgin şekilde aşıyor`,
          severity: 'warning',
        });
      }
    });
    s.annotations.forEach((a, aIdx) => {
      if (a.target && !nodeIds.has(a.target)) {
        issues.push({ path: `${base}.annotations.${aIdx}.target`, message: `Bilinmeyen düğüm: ${a.target}`, severity: 'error' });
      }
    });
  });

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { ok: !hasErrors, scene: hasErrors ? undefined : scene, issues };
}

/** Geçerli değilse hata fırlatan kısa yol. */
export function parseScene(input: AnimationSceneInput | unknown): AnimationScene {
  const result = validateScene(input);
  if (!result.ok || !result.scene) {
    const details = result.issues
      .filter((i) => i.severity === 'error')
      .map((i) => `${i.path}: ${i.message}`)
      .join('\n');
    throw new Error(`Geçersiz animasyon sahnesi:\n${details}`);
  }
  return result.scene;
}
