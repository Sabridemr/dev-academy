import { describe, expect, it } from 'vitest';
import example from '../../examples/load-balancer-round-robin.scene.json';
import { validateScene, parseScene } from './validate';
import {
  computePackets,
  createPlayerState,
  playerReducer,
  resolveStepView,
  sceneDuration,
  sceneTranscript,
} from './player';
import { edgeGeometry, packetPosition } from './geometry';

describe('AnimationScene şeması', () => {
  it('örnek sahne geçerli', () => {
    const result = validateScene(example);
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.scene?.steps).toHaveLength(5);
  });

  it('bilinmeyen düğüm referansını yakalar', () => {
    const broken = JSON.parse(JSON.stringify(example));
    broken.edges[0].to = 'yok';
    const result = validateScene(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('yok'))).toBe(true);
  });

  it('tekrarlanan id’leri yakalar', () => {
    const broken = JSON.parse(JSON.stringify(example));
    broken.nodes[1].id = broken.nodes[0].id;
    expect(validateScene(broken).ok).toBe(false);
  });

  it('parseScene hatada fırlatır', () => {
    expect(() => parseScene({ id: 'x' })).toThrow(/Geçersiz animasyon sahnesi/);
  });
});

describe('Oynatıcı durum makinesi', () => {
  const scene = parseScene(example);

  it('TICK ile adımlar ilerler ve sonda durur', () => {
    let s = playerReducer(scene, createPlayerState(scene), { type: 'PLAY' });
    const total = sceneDuration(scene);
    for (let t = 0; t < total + 1000; t += 100) {
      s = playerReducer(scene, s, { type: 'TICK', deltaMs: 100 });
    }
    expect(s.finished).toBe(true);
    expect(s.playing).toBe(false);
    expect(s.stepIndex).toBe(scene.steps.length - 1);
  });

  it('hız çarpanı süreyi kısaltır', () => {
    let s = playerReducer(scene, createPlayerState(scene), { type: 'PLAY' });
    s = playerReducer(scene, s, { type: 'SET_SPEED', speed: 2 });
    s = playerReducer(scene, s, { type: 'TICK', deltaMs: 1600 });
    // ilk adım 3000ms, 2x hızda 1600ms*2=3200 → ikinci adıma geçmeli
    expect(s.stepIndex).toBe(1);
  });

  it('NEXT/PREV sınırları aşmaz', () => {
    let s = createPlayerState(scene);
    s = playerReducer(scene, s, { type: 'PREV' });
    expect(s.stepIndex).toBe(0);
    for (let i = 0; i < 10; i++) s = playerReducer(scene, s, { type: 'NEXT' });
    expect(s.stepIndex).toBe(scene.steps.length - 1);
    expect(s.finished).toBe(true);
  });

  it('inherit zinciri ile durumlar birikir', () => {
    const v3 = resolveStepView(scene, 3); // health-check adımı
    expect(v3.nodes.s2.status).toBe('muted');
    expect(v3.nodes.s1.status).toBe('active'); // 2. adımdan devralındı
    expect(v3.edges['hc-s2'].highlighted).toBe(true);
    const v0 = resolveStepView(scene, 0);
    expect(v0.nodes.s2.status).toBe('idle');
  });

  it('paket ilerlemesi zamana göre hesaplanır', () => {
    const step = scene.steps[1];
    const none = computePackets(step, 0);
    expect(none[0].progress).toBe(0);
    const mid = computePackets(step, 450);
    expect(mid[0].progress).toBeCloseTo(0.5, 1);
    expect(mid[1].progress).toBeNull();
    const reduced = computePackets(step, 2000, true);
    expect(reduced[0].progress).toBe(1);
  });

  it('transkript adım anlatımlarından türetilir', () => {
    expect(sceneTranscript(scene)).toHaveLength(scene.steps.length);
  });
});

describe('Geometri', () => {
  const scene = parseScene(example);
  it('kenar geometrisi düğüm sınırlarından başlar', () => {
    const geom = edgeGeometry(scene, scene.edges[0])!;
    expect(geom.start.x).toBeGreaterThan(110); // users merkezinin sağı
    expect(geom.end.x).toBeLessThan(420); // lb merkezinin solu
    const p0 = packetPosition(geom, 0, 'forward');
    const p1 = packetPosition(geom, 1, 'forward');
    expect(p0).toEqual(geom.start);
    expect(p1.x).toBeCloseTo(geom.end.x);
    const back = packetPosition(geom, 0, 'backward');
    expect(back.x).toBeCloseTo(geom.end.x);
  });
});
