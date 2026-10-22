import { describe, expect, it } from 'vitest';
import {
  RESOURCES,
  USERS,
  PolicyParseError,
  abacEvaluator,
  allowedSet,
  defaultMatrix,
  defaultRules,
  escalatedMatrix,
  escalatedRules,
  evalExpr,
  evaluateAbac,
  evaluateRbac,
  extraGrants,
  parseCondition,
  rbacEvaluator,
  toggleMatrix,
  type Comparison,
  type Rule,
} from './rbacAbac.logic';

const u = (id: string) => USERS.find((x) => x.id === id)!;
const r = (id: string) => RESOURCES.find((x) => x.id === id)!;

describe('ABAC ifade dili', () => {
  const ctx = { user: u('can'), resource: r('inv-1043'), action: 'read' as const };

  it('AND/OR/NOT önceliği ve parantez', () => {
    expect(evalExpr(parseCondition('true OR false AND false'), ctx)).toBe(true);
    expect(evalExpr(parseCondition('(true OR false) AND false'), ctx)).toBe(false);
    expect(evalExpr(parseCondition('NOT false AND true'), ctx)).toBe(true);
    expect(evalExpr(parseCondition('!(user.level >= 2) && action == "read"'), ctx)).toBe(true);
  });

  it('öznitelikler, listeler, sayılar ve hassasiyet sıralaması', () => {
    const t: Comparison[] = [];
    expect(evalExpr(parseCondition('user.department == resource.department'), ctx, t)).toBe(true);
    expect(t[0]).toEqual({
      text: 'user.department (finance) == resource.department (finance)',
      result: true,
    });
    expect(evalExpr(parseCondition('action in [read, write]'), ctx)).toBe(true);
    expect(evalExpr(parseCondition("action in ['delete']"), ctx)).toBe(false);
    expect(evalExpr(parseCondition('user.level < 2'), ctx)).toBe(true);
    expect(evalExpr(parseCondition('resource.sensitivity > internal'), ctx)).toBe(true);
    expect(evalExpr(parseCondition('resource.id in user.owns'), { ...ctx, user: u('ayse') })).toBe(
      true,
    );
    expect(evalExpr(parseCondition('resource.id in user.owns'), ctx)).toBe(false);
  });

  it('bilinmeyen öznitelik her karşılaştırmada yanlış döner (güvenli taraf)', () => {
    expect(evalExpr(parseCondition('user.clearance == 3'), ctx)).toBe(false);
    expect(evalExpr(parseCondition('user.clearance != 3'), ctx)).toBe(false);
  });

  it('sözdizimi hatalarını bildirir', () => {
    for (const bad of [
      'user.department ==',
      'action in [read',
      'foo.bar == 1',
      'user.level 2',
      '(true',
      "action == 'x",
      'a # b',
    ]) {
      expect(() => parseCondition(bad), bad).toThrow(PolicyParseError);
    }
  });
});

describe('RBAC', () => {
  it('yalnızca rol × eyleme bakar', () => {
    const m = defaultMatrix();
    expect(evaluateRbac(u('mehmet'), 'write', r('doc-offer'), m).allowed).toBe(true);
    // editor her departmanın faturasına yazabilir: RBAC sahiplik bilmez
    expect(evaluateRbac(u('mehmet'), 'write', r('inv-1043'), m).allowed).toBe(true);
    expect(evaluateRbac(u('zeynep'), 'write', r('doc-offer'), m).allowed).toBe(false);
    const toggled = toggleMatrix(m, 'viewer', 'write');
    expect(evaluateRbac(u('zeynep'), 'write', r('doc-offer'), toggled).allowed).toBe(true);
    expect(m.viewer.write).toBe(false);
  });

  it('ayrıcalık yükseltme: viewer’a silme tüm viewer’lara ve tüm kaynaklara yayılır', () => {
    const base = allowedSet(rbacEvaluator(defaultMatrix()));
    const extra = extraGrants(base, allowedSet(rbacEvaluator(escalatedMatrix())));
    expect(extra).toContain('can:delete:inv-1043');
    // 2 viewer × 4 kaynak
    expect(extra).toHaveLength(8);
    expect(
      evaluateRbac(u('can'), 'delete', r('inv-1043'), escalatedMatrix()).steps.at(-1)?.kind,
    ).toBe('decision');
  });
});

describe('ABAC değerlendirme', () => {
  const rules = defaultRules();

  it('sahip kendi kaynağına yazar, başkası yazamaz (varsayılan ret)', () => {
    const own = evaluateAbac(u('mehmet'), 'write', r('doc-offer'), rules);
    expect(own).toMatchObject({ allowed: true, reason: 'allow-rule', ruleId: 'r3' });
    const other = evaluateAbac(u('zeynep'), 'write', r('doc-offer'), rules);
    expect(other).toMatchObject({ allowed: false, reason: 'default-deny' });
  });

  it('deny-overrides: açık ret izni ezer; first-applicable: sıra belirler', () => {
    const d = evaluateAbac(u('can'), 'read', r('inv-1043'), rules, 'deny-overrides');
    expect(d).toMatchObject({ allowed: false, reason: 'explicit-deny', ruleId: 'r5' });
    const f = evaluateAbac(u('can'), 'read', r('inv-1043'), rules, 'first-applicable');
    expect(f).toMatchObject({ allowed: true, ruleId: 'r2' });
    // Ret kuralını başa taşıyınca ilk eşleşen yine ret olur
    const reordered: Rule[] = [rules[4], ...rules.filter((x) => x.id !== 'r5')];
    expect(
      evaluateAbac(u('can'), 'read', r('inv-1043'), reordered, 'first-applicable').allowed,
    ).toBe(false);
    // first-applicable kararı verdikten sonraki kurallar değerlendirilmez
    expect(
      f.steps.filter((s) => s.kind === 'skip' && s.text.en.includes('not evaluated')).length,
    ).toBe(4);
  });

  it('yönetici kendi departmanında onaylar; admin her şeyi yapar', () => {
    expect(evaluateAbac(u('ayse'), 'approve', r('rep-q3'), rules).allowed).toBe(true);
    expect(evaluateAbac(u('ayse'), 'approve', r('doc-offer'), rules).allowed).toBe(false);
    expect(evaluateAbac(u('elif'), 'delete', r('inv-1043'), rules).allowed).toBe(true);
  });

  it('hatalı kural atlanır ve adımlarda raporlanır', () => {
    const d = evaluateAbac(u('zeynep'), 'read', r('doc-notice'), [
      { id: 'x', effect: 'allow', condition: 'action ==' },
      ...rules,
    ]);
    expect(d.steps.some((s) => s.kind === 'error' && s.ruleId === 'x')).toBe(true);
    expect(d.allowed).toBe(true);
  });

  it('ayrıcalık yükseltme: AND yerine OR herkese yazma yetkisi verir', () => {
    expect(evaluateAbac(u('zeynep'), 'write', r('rep-q3'), rules).allowed).toBe(false);
    expect(evaluateAbac(u('zeynep'), 'write', r('rep-q3'), escalatedRules()).allowed).toBe(true);
    const extra = extraGrants(
      allowedSet(abacEvaluator(rules, 'deny-overrides')),
      allowedSet(abacEvaluator(escalatedRules(), 'deny-overrides')),
    );
    expect(extra).toContain('zeynep:write:rep-q3');
    // Gizli fatura hâlâ #5 ile korunur
    expect(extra).not.toContain('zeynep:write:inv-1043');
  });
});
