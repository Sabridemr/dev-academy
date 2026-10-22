import { describe, expect, it } from 'vitest';
import { PY_MEMORY_SCENARIOS, SCENARIO_CODE, runPython, type PyStep } from './pythonMemory.logic';

const last = (steps: PyStep[]) => steps[steps.length - 1];
const varId = (step: PyStep, name: string, frame = 0) =>
  step.frames[frame].vars.find(([n]) => n === name)?.[1];
const obj = (step: PyStep, id: number | undefined) => step.heap.find((o) => o.id === id);

describe('pythonMemory mini yorumlayıcı', () => {
  it('her hazır senaryo ayrıştırılır ve çalışır (immutable-rebind beklenen TypeError ile biter)', () => {
    for (const s of PY_MEMORY_SCENARIOS) {
      const r = runPython(SCENARIO_CODE[s]);
      expect(r.steps.length).toBeGreaterThan(3);
      if (s === 'immutable-rebind') {
        expect(r.error?.kind).toBe('runtime');
        expect(r.error?.message.en).toBe(
          "TypeError: 'tuple' object does not support item assignment",
        );
      } else {
        expect(r.error).toBeUndefined();
      }
    }
  });

  it('b = a takma ad oluşturur: append iki isimden de görünür, refcount 2', () => {
    const r = runPython('a = [1, 2]\nb = a\nb.append(3)\nprint(a, a is b)');
    const s = last(r.steps);
    expect(varId(s, 'a')).toBe(varId(s, 'b'));
    expect(obj(s, varId(s, 'a'))?.refcount).toBe(2);
    expect(s.output).toEqual(['[1, 2, 3] True']);
  });

  it('a = a + [x] yeni liste oluşturur; a.append aynı listeyi değiştirir', () => {
    const r = runPython('a = [1]\nb = a\na = a + [2]\nprint(a, b, a is b)');
    expect(last(r.steps).output).toEqual(['[1, 2] [1] False']);
    const r2 = runPython('a = [1]\nb = a\na += [2]\nprint(a, b, a is b)');
    expect(last(r2.steps).output).toEqual(['[1, 2] [1, 2] True']);
  });

  it('değiştirilemez int yeniden bağlanır; küçük int önbellekte paylaşılır', () => {
    const r = runPython(
      'x = 300\ny = x\nx = x + 1\nprint(x, y)\na = 5\nb = 5\nprint(a is b)\nc = 1000\nd = 1000\nprint(c is d)',
    );
    const s = last(r.steps);
    expect(s.output).toEqual(['301 300', 'True', 'False']);
    expect(obj(s, varId(s, 'a'))?.cached).toBe(true);
  });

  it('sığ kopya iç listeleri paylaşır, deepcopy paylaşmaz', () => {
    const r = runPython(SCENARIO_CODE['shallow-vs-deep']);
    const s = last(r.steps);
    expect(s.output).toEqual(['[[1, 2, 99], [3, 4]]', '[[1, 2], [3, 4]]', 'False True']);
    const sig = obj(s, varId(s, 'sig'))!;
    const orijinal = obj(s, varId(s, 'orijinal'))!;
    const derin = obj(s, varId(s, 'derin'))!;
    expect(sig.items).toEqual(orijinal.items);
    expect(derin.items?.some((id) => orijinal.items?.includes(id))).toBe(false);
  });

  it('fonksiyon çağrısı çerçeve açar, parametre aynı nesneye bağlanır, dönüşte çerçeve kapanır', () => {
    const r = runPython(
      'def f(liste):\n    liste.append(9)\n    return liste\n\nx = [1]\ny = f(x)',
    );
    const call = r.steps.find((s) => s.frames.length === 2)!;
    expect(call.frames[1].name).toBe('f');
    expect(varId(call, 'liste', 1)).toBe(varId(call, 'x'));
    expect(obj(call, varId(call, 'x'))?.refcount).toBe(2);
    const end = last(r.steps);
    expect(end.frames).toHaveLength(1);
    expect(varId(end, 'y')).toBe(varId(end, 'x'));
  });

  it('refcount 0 olan nesne hemen silinir, zincirleme iç nesneler de gider', () => {
    const r = runPython('a = [[1], [2]]\nb = a\ndel a\nb = None');
    const del = r.steps[3];
    expect(del.freed).toEqual([]);
    expect(del.events).toContainEqual({ kind: 'unbind', frame: 'global', name: 'a' });
    const rebind = r.steps[4];
    expect(rebind.freed.map((f) => f.repr)).toEqual(
      expect.arrayContaining(['[[1], [2]]', '[1]', '[2]']),
    );
    expect(rebind.heap.filter((o) => o.type === 'list')).toEqual([]);
  });

  it('döngüsel referans del ile silinmez, gc.collect() toplar', () => {
    const r = runPython('import gc\nd = []\nd.append(d)\ndel d\ngc.collect()');
    const afterDel = r.steps[4];
    expect(afterDel.heap.find((o) => o.type === 'list')?.refcount).toBe(1);
    const afterGc = last(r.steps);
    expect(afterGc.heap.find((o) => o.type === 'list')).toBeUndefined();
    expect(afterGc.events).toContainEqual(expect.objectContaining({ kind: 'free', cycle: true }));
    expect(afterGc.output).toEqual(['1']);
  });

  it('is ve == farkı; tuple içindeki liste değiştirilebilir', () => {
    const r = runPython(
      'a = [1, 2]\nc = [1, 2]\nprint(a == c, a is c)\nt = (1, [2])\nt[1].append(3)\nprint(t)',
    );
    expect(last(r.steps).output).toEqual(['True False', '(1, [2, 3])']);
  });

  it('desteklenmeyen yapıyı satır numarasıyla anlaşılır hatayla reddeder', () => {
    const cases: [string, number, RegExp][] = [
      ['x = 1\nfor i in x:\n    pass', 2, /'for' bu simülatörde desteklenmiyor/],
      ['class A:\n    pass', 1, /'class'/],
      ['a = [1]\na.sort()', 2, /\.sort\(\) metodu bu simülatörde yok/],
      ['a, b = 1, 2', 1, /Çoklu atama/],
      ['import os', 1, /"os" modülü/],
      ['x = [i for i in y]', 1, /comprehension/],
      ['def f(x=[]):\n    return x', 1, /varsayılan değer/],
    ];
    for (const [src, line, re] of cases) {
      const r = runPython(src);
      expect(r.steps).toEqual([]);
      expect(r.error?.kind).toBe('unsupported');
      expect(r.error?.line).toBe(line);
      expect(r.error?.message.tr).toMatch(re);
    }
  });

  it('sözdizimi ve çalışma zamanı hatalarını ayırır', () => {
    expect(runPython('x = (1, 2').error?.kind).toBe('unsupported');
    expect(runPython('x = "abc').error?.kind).toBe('syntax');
    const r = runPython('a = [1]\nprint(b)');
    expect(r.error).toMatchObject({
      kind: 'runtime',
      line: 2,
      message: { en: "NameError: name 'b' is not defined" },
    });
    expect(last(r.steps).error).toBeDefined();
    expect(runPython('d = {[1]: 2}').error?.message.en).toBe("TypeError: unhashable type: 'list'");
  });

  it('sonsuz özyinelemeyi sınırlar', () => {
    const r = runPython('def f(n):\n    return f(n)\n\nf(1)');
    expect(r.error?.message.en).toBe('RecursionError: maximum recursion depth exceeded');
  });
});
