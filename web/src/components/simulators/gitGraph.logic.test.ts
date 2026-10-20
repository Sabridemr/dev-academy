import { describe, expect, it } from 'vitest';
import { gitReducer, initialGitState, isAncestor, mergeBase, reachable } from './gitGraph.logic';

describe('gitGraph.logic', () => {
  it('commit dal ucunu ilerletir ve gerekirse switch yazar', () => {
    const s = gitReducer(initialGitState('merge'), { type: 'commit', branch: 'feature' });
    expect(s.head).toBe('feature');
    expect(s.heads.feature).toBe('c6');
    expect(s.commits.find((c) => c.id === 'c6')!.parents).toEqual(['c4']);
    expect(s.log.map((l) => l.text)).toEqual([
      'git switch feature',
      'git commit -am "edit feature.js"',
    ]);
  });

  it('ayrışmış dallarda merge commit oluşturur', () => {
    const s = gitReducer(initialGitState('merge'), { type: 'merge' });
    const m = s.commits.find((c) => c.id === s.heads.main)!;
    expect(m.merge).toBe(true);
    expect(m.parents).toEqual(['c5', 'c4']);
    expect(isAncestor(s, 'c4', s.heads.main)).toBe(true);
  });

  it('merge sonrası ikinci merge "Already up to date", feature rebase fast-forward', () => {
    let s = gitReducer(initialGitState('merge'), { type: 'merge' });
    s = gitReducer(s, { type: 'merge' });
    expect(s.log[s.log.length - 1].text).toBe('Already up to date.');
  });

  it('fast-forward merge', () => {
    let s = initialGitState('merge');
    s = gitReducer(s, { type: 'rebase' });
    s = gitReducer(s, { type: 'merge' });
    expect(s.heads.main).toBe(s.heads.feature);
    expect(s.log[s.log.length - 1].text).toMatch(/^Fast-forward/);
  });

  it('rebase commitleri main ucuna yeniden oynatır, eskiler orphan olur', () => {
    const s = gitReducer(initialGitState('rebase'), { type: 'rebase' });
    const tip = s.commits.find((c) => c.id === s.heads.feature)!;
    expect(tip.label).toBe("C4'");
    expect(mergeBase(s, s.heads.main, s.heads.feature)).toBe('c5');
    expect(s.commits.filter((c) => c.orphan).map((c) => c.id)).toEqual(['c3', 'c4']);
    expect(reachable(s).has('c3')).toBe(false);
  });

  it('conflict senaryosunda merge durur, resolve merge commit oluşturur', () => {
    let s = gitReducer(initialGitState('conflict'), { type: 'merge' });
    expect(s.conflict).toMatchObject({ op: 'merge', files: ['app.js'] });
    // çakışma varken diğer işlemler yok sayılır
    expect(gitReducer(s, { type: 'commit', branch: 'main' })).toBe(s);
    s = gitReducer(s, { type: 'resolve' });
    expect(s.conflict).toBeNull();
    expect(s.commits.find((c) => c.id === s.heads.main)!.merge).toBe(true);
  });

  it('conflict senaryosunda rebase durur, --continue ile tamamlanır', () => {
    let s = gitReducer(initialGitState('conflict'), { type: 'rebase' });
    expect(s.conflict?.op).toBe('rebase');
    s = gitReducer(s, { type: 'resolve' });
    expect(s.conflict).toBeNull();
    expect(s.commits.find((c) => c.id === s.heads.feature)!.parents).toEqual(['c3']);
    expect(s.log.some((l) => l.text === 'git rebase --continue')).toBe(true);
  });

  it('reset senaryonun başlangıcına döner', () => {
    const s0 = initialGitState('rebase');
    const s = gitReducer(gitReducer(s0, { type: 'rebase' }), { type: 'reset' });
    expect(s).toEqual(s0);
  });
});
