import { describe, expect, it } from 'vitest';
import { annotationBox, badgeBox, nodeTextLayout, truncateToWidth } from './geometry';
import { parseScene } from './validate';
import type { SceneNode } from './schema';

const node = (over: Partial<SceneNode>): SceneNode =>
  ({ id: 'n', kind: 'service', label: 'x', x: 500, y: 300, status: 'idle', ...over }) as SceneNode;

describe('Yerleşim yardımcıları', () => {
  it('truncateToWidth uzun metni … ile kısaltır, kısa metne dokunmaz', () => {
    expect(truncateToWidth('Kısa', 200, 12)).toBe('Kısa');
    const t = truncateToWidth('Çok uzun bir düğüm etiketi metni', 60, 12);
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBeLessThan(12);
  });

  it('alçak düğümde ikon gizlenir, metin dikey ortalanır', () => {
    const low = nodeTextLayout(node({ h: 44, w: 140 }), 'Fiyatlama', 'surge / hücre');
    expect(low.showIcon).toBe(false);
    const tall = nodeTextLayout(node({ h: 74, w: 150 }), 'NestJS API', 'REST + WebSocket');
    expect(tall.showIcon).toBe(true);
    expect(tall.iconCentered).toBe(false);
  });

  it('dar düğümde (telefon) etiket alta yazılır ve kısaltılmaz', () => {
    const l = nodeTextLayout(node({ kind: 'mobile' }), 'Sürücü', 'GPS · 4 s');
    expect(l.label).toBe('Sürücü');
    expect(l.iconCentered).toBe(true);
    expect(l.labelDy).toBeGreaterThan(0);
  });

  it('not kutusu tuval dışına taşmaz', () => {
    const scene = parseScene({
      id: 's',
      title: 't',
      a11y: { description: 'd' },
      nodes: [{ id: 'a', label: 'A', x: 10, y: 10 }],
      steps: [{ id: 's1', title: 't', narration: 'n' }],
    });
    const box = annotationBox(scene, { x: 990, y: 5 }, 'Kosinüs benzerliği, yaklaşık (ANN) arama');
    expect(box.x + box.w / 2).toBeLessThanOrEqual(scene.canvas.width);
    expect(box.y - box.h / 2).toBeGreaterThanOrEqual(0);
  });

  it('rozet: kısa metin daire, uzun metin hap; 12 karakter üstü kısaltılır', () => {
    expect(badgeBox(node({}), '3').w).toBe(26);
    expect(badgeBox(node({}), 'z = 0.465').text).toBe('z = 0.465');
    expect(badgeBox(node({}), 'çok uzun bir rozet').text.endsWith('…')).toBe(true);
  });
});
