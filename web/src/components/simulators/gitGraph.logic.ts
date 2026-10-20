/**
 * Git commit grafiği simülatörünün saf durum makinesi: commit, merge (fast-forward / merge commit /
 * çakışma), rebase (commit'leri yeniden oynatma, çakışmada durma), çakışma çözümü ve sıfırlama.
 */

export const GIT_SCENARIOS = ['merge', 'rebase', 'conflict'] as const;
export type GitScenario = (typeof GIT_SCENARIOS)[number];
export type Branch = 'main' | 'feature';

export interface Commit {
  id: string;
  label: string;
  parents: string[];
  branch: Branch;
  files: string[];
  message: string;
  /** Yatay konum (oluşturulma sırası) */
  col: number;
  merge?: boolean;
  /** Rebase sonrası hiçbir daldan erişilemeyen eski commit */
  orphan?: boolean;
}

export interface Conflict {
  op: 'merge' | 'rebase';
  files: string[];
  /** rebase: henüz oynatılmamış (çakışan dahil) commit id'leri */
  pending: string[];
  /** rebase: yeniden oynatmanın devam edeceği taban commit */
  onto: string | null;
  /** rebase: eski feature commit'leri (bitince orphan işaretlenir) */
  replaced: string[];
}

export interface LogLine {
  kind: 'cmd' | 'out' | 'error';
  text: string;
}

export interface GitState {
  scenario: GitScenario;
  commits: Commit[];
  heads: Record<Branch, string>;
  head: Branch;
  conflict: Conflict | null;
  log: LogLine[];
  counter: number;
  nextCol: number;
}

export type GitAction =
  | { type: 'commit'; branch: Branch }
  | { type: 'merge' }
  | { type: 'rebase' }
  | { type: 'resolve' }
  | { type: 'reset' };

/** Senaryoya göre dalın değiştirdiği dosya: conflict'te iki dal aynı dosyaya dokunur */
export function fileFor(scenario: GitScenario, branch: Branch): string {
  if (scenario === 'conflict') return 'app.js';
  return branch === 'main' ? 'server.js' : 'feature.js';
}

export function initialGitState(scenario: GitScenario): GitState {
  const mk = (n: number, parent: string | null, branch: Branch, file: string): Commit => ({
    id: `c${n}`,
    label: `C${n}`,
    parents: parent ? [parent] : [],
    branch,
    files: [file],
    message: n === 1 ? 'initial commit' : `edit ${file}`,
    col: n - 1,
  });
  if (scenario === 'conflict') {
    const commits = [
      mk(1, null, 'main', 'app.js'),
      mk(2, 'c1', 'feature', 'app.js'),
      mk(3, 'c1', 'main', 'app.js'),
    ];
    return {
      scenario,
      commits,
      heads: { main: 'c3', feature: 'c2' },
      head: 'main',
      conflict: null,
      log: [],
      counter: 3,
      nextCol: 3,
    };
  }
  const m = fileFor(scenario, 'main');
  const f = fileFor(scenario, 'feature');
  const commits = [
    mk(1, null, 'main', m),
    mk(2, 'c1', 'main', m),
    mk(3, 'c2', 'feature', f),
    mk(4, 'c3', 'feature', f),
    mk(5, 'c2', 'main', m),
  ];
  return {
    scenario,
    commits,
    heads: { main: 'c5', feature: 'c4' },
    head: scenario === 'rebase' ? 'feature' : 'main',
    conflict: null,
    log: [],
    counter: 5,
    nextCol: 5,
  };
}

const byId = (s: GitState, id: string) => s.commits.find((c) => c.id === id)!;

/** id ve tüm ataları */
export function ancestors(s: GitState, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    stack.push(...byId(s, cur).parents);
  }
  return out;
}

export const isAncestor = (s: GitState, a: string, b: string) => ancestors(s, b).has(a);

export function mergeBase(s: GitState, a: string, b: string): string | null {
  const ofA = ancestors(s, a);
  const queue = [b];
  const seen = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    if (ofA.has(cur)) return cur;
    if (seen.has(cur)) continue;
    seen.add(cur);
    queue.push(...byId(s, cur).parents);
  }
  return null;
}

/** tip'ten erişilebilen ama base'den erişilemeyen commit'ler (oluşturulma sırasıyla) */
export function uniqueCommits(s: GitState, tip: string, base: string | null): Commit[] {
  const exclude = base ? ancestors(s, base) : new Set<string>();
  const ids = ancestors(s, tip);
  return s.commits.filter((c) => ids.has(c.id) && !exclude.has(c.id)).sort((x, y) => x.col - y.col);
}

const changedFiles = (s: GitState, tip: string, base: string | null) =>
  new Set(uniqueCommits(s, tip, base).flatMap((c) => c.files));

function withSwitch(s: GitState, branch: Branch): GitState {
  if (s.head === branch) return s;
  return { ...s, head: branch, log: [...s.log, { kind: 'cmd', text: `git switch ${branch}` }] };
}

function addCommit(
  s: GitState,
  c: Omit<Commit, 'id' | 'col' | 'label'> & { label?: string },
): {
  state: GitState;
  id: string;
} {
  const n = s.counter + 1;
  const id = `c${n}`;
  const commit: Commit = { ...c, id, label: c.label ?? `C${n}`, col: s.nextCol };
  return {
    state: { ...s, commits: [...s.commits, commit], counter: n, nextCol: s.nextCol + 1 },
    id,
  };
}

const log = (s: GitState, ...lines: LogLine[]): GitState => ({ ...s, log: [...s.log, ...lines] });

/** Rebase'i `onto` üzerinden `pending` commit'leriyle sürdürür; checkConflict ise çakışmada durur */
function replay(
  s0: GitState,
  pending: string[],
  onto: string,
  replaced: string[],
  checkFiles: Set<string> | null,
): GitState {
  let s = s0;
  let base = onto;
  for (let k = 0; k < pending.length; k++) {
    const orig = byId(s, pending[k]);
    const clash = checkFiles ? orig.files.filter((f) => checkFiles.has(f)) : [];
    if (clash.length) {
      return log(
        {
          ...s,
          conflict: { op: 'rebase', files: clash, pending: pending.slice(k), onto: base, replaced },
        },
        { kind: 'error', text: `CONFLICT (content): Merge conflict in ${clash.join(', ')}` },
        { kind: 'error', text: `error: could not apply ${orig.label}... ${orig.message}` },
      );
    }
    const r = addCommit(s, {
      label: `${orig.label}'`,
      parents: [base],
      branch: 'feature',
      files: orig.files,
      message: orig.message,
    });
    s = r.state;
    base = r.id;
  }
  const replacedSet = new Set(replaced);
  return log(
    {
      ...s,
      conflict: null,
      heads: { ...s.heads, feature: base },
      commits: s.commits.map((c) => (replacedSet.has(c.id) ? { ...c, orphan: true } : c)),
    },
    { kind: 'out', text: 'Successfully rebased and updated refs/heads/feature.' },
  );
}

export function gitReducer(state: GitState, action: GitAction): GitState {
  if (action.type === 'reset') return initialGitState(state.scenario);
  if (state.conflict && action.type !== 'resolve') return state;

  switch (action.type) {
    case 'commit': {
      let s = withSwitch(state, action.branch);
      const file = fileFor(s.scenario, action.branch);
      const message = `edit ${file}`;
      const r = addCommit(s, {
        parents: [s.heads[action.branch]],
        branch: action.branch,
        files: [file],
        message,
      });
      s = { ...r.state, heads: { ...r.state.heads, [action.branch]: r.id } };
      return log(s, { kind: 'cmd', text: `git commit -am "${message}"` });
    }
    case 'merge': {
      let s = log(withSwitch(state, 'main'), { kind: 'cmd', text: 'git merge feature' });
      const main = s.heads.main;
      const feat = s.heads.feature;
      if (isAncestor(s, feat, main)) return log(s, { kind: 'out', text: 'Already up to date.' });
      if (isAncestor(s, main, feat)) {
        return log(
          { ...s, heads: { ...s.heads, main: feat } },
          { kind: 'out', text: `Fast-forward ${byId(s, main).label}..${byId(s, feat).label}` },
        );
      }
      const base = mergeBase(s, main, feat);
      const ours = changedFiles(s, main, base);
      const clash = [...changedFiles(s, feat, base)].filter((f) => ours.has(f));
      if (clash.length) {
        return log(
          { ...s, conflict: { op: 'merge', files: clash, pending: [], onto: null, replaced: [] } },
          { kind: 'error', text: `CONFLICT (content): Merge conflict in ${clash.join(', ')}` },
          {
            kind: 'error',
            text: 'Automatic merge failed; fix conflicts and then commit the result.',
          },
        );
      }
      const r = addCommit(s, {
        parents: [main, feat],
        branch: 'main',
        files: [],
        message: "Merge branch 'feature'",
        merge: true,
      });
      s = { ...r.state, heads: { ...r.state.heads, main: r.id } };
      return log(s, { kind: 'out', text: "Merge made by the 'ort' strategy." });
    }
    case 'rebase': {
      const s = log(withSwitch(state, 'feature'), { kind: 'cmd', text: 'git rebase main' });
      const main = s.heads.main;
      const feat = s.heads.feature;
      if (isAncestor(s, main, feat)) {
        return log(s, { kind: 'out', text: 'Current branch feature is up to date.' });
      }
      if (isAncestor(s, feat, main)) {
        return log(
          { ...s, heads: { ...s.heads, feature: main } },
          { kind: 'out', text: 'Successfully rebased and updated refs/heads/feature.' },
        );
      }
      const base = mergeBase(s, main, feat);
      const toReplay = uniqueCommits(s, feat, base).filter((c) => !c.merge);
      const ids = toReplay.map((c) => c.id);
      return replay(s, ids, main, ids, changedFiles(s, main, base));
    }
    case 'resolve': {
      const c = state.conflict;
      if (!c) return state;
      let s = log(state, { kind: 'cmd', text: `git add ${c.files.join(' ')}` });
      if (c.op === 'merge') {
        const r = addCommit(
          { ...s, conflict: null },
          {
            parents: [s.heads.main, s.heads.feature],
            branch: 'main',
            files: c.files,
            message: "Merge branch 'feature'",
            merge: true,
          },
        );
        s = { ...r.state, heads: { ...r.state.heads, main: r.id } };
        return log(s, { kind: 'cmd', text: 'git commit -m "Merge branch \'feature\'"' });
      }
      s = log(s, { kind: 'cmd', text: 'git rebase --continue' });
      return replay({ ...s, conflict: null }, c.pending, c.onto!, c.replaced, null);
    }
  }
}

/** Görünür (orphan olmayan ya da hâlâ bir daldan erişilebilen) commit'ler */
export function reachable(s: GitState): Set<string> {
  const a = ancestors(s, s.heads.main);
  for (const id of ancestors(s, s.heads.feature)) a.add(id);
  if (s.conflict?.onto) for (const id of ancestors(s, s.conflict.onto)) a.add(id);
  return a;
}
