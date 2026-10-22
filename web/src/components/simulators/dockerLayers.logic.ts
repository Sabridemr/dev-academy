/**
 * Dockerfile → imaj katmanları görselleştiricisinin saf mantığı:
 *  - Dockerfile ayrıştırma (satır devamı `\`, yorumlar, çok aşamalı `FROM ... AS ad`),
 *  - hangi talimatın dosya sistemi katmanı ürettiği (RUN/COPY/ADD) ve hangisinin yalnızca metadata olduğu,
 *  - kural tabanlı tahmini katman boyutları,
 *  - build cache simülasyonu: bir değişiklik (bağımlılık dosyası, kaynak kod, bir RUN satırı) hangi adımdan
 *    itibaren cache'i bozar,
 *  - final imaja giren katmanlar ve yaygın hatalar için uyarılar.
 * Boyutlar gerçek bir derlemeden değil kaba kurallardan gelir; amaç büyüklük mertebesini ve sırayı göstermektir.
 */

export const DOCKER_EXAMPLES = ['node-basic', 'node-multistage', 'python-cached'] as const;
export type DockerExampleId = (typeof DOCKER_EXAMPLES)[number];

export const INSTRUCTIONS = [
  'FROM',
  'RUN',
  'COPY',
  'ADD',
  'WORKDIR',
  'ENV',
  'ARG',
  'EXPOSE',
  'CMD',
  'ENTRYPOINT',
  'USER',
  'LABEL',
  'HEALTHCHECK',
  'VOLUME',
  'SHELL',
  'STOPSIGNAL',
  'ONBUILD',
] as const;
export type InstructionKind = (typeof INSTRUCTIONS)[number];

/** Dosya sistemi katmanı üreten talimatlar; diğerleri yalnızca imaj yapılandırmasını (metadata) değiştirir */
export const LAYER_INSTRUCTIONS: readonly InstructionKind[] = ['RUN', 'COPY', 'ADD'];

export interface Instruction {
  /** 1 tabanlı başlangıç satırı */
  line: number;
  kind: InstructionKind;
  /** Talimat adından sonraki metin (satır devamları birleştirilmiş) */
  args: string;
  stage: number;
  createsLayer: boolean;
}

export interface Stage {
  index: number;
  /** `FROM ... AS ad` */
  name?: string;
  /** FROM'daki imaj ya da önceki aşamanın adı */
  base: string;
  /** Taban önceki bir aşamaysa onun indeksi */
  baseStage?: number;
  line: number;
  instructions: Instruction[];
}

export interface ParseError {
  line: number;
  code: 'unknown-instruction' | 'before-from' | 'empty' | 'missing-args';
  text: string;
}

export interface ParsedDockerfile {
  stages: Stage[];
  instructions: Instruction[];
  errors: ParseError[];
}

export function parseDockerfile(text: string): ParsedDockerfile {
  const lines = text.split(/\r?\n/);
  const instructions: Instruction[] = [];
  const stages: Stage[] = [];
  const errors: ParseError[] = [];
  let i = 0;
  while (i < lines.length) {
    const startLine = i + 1;
    let raw = lines[i]!;
    i++;
    if (/^\s*(#|$)/.test(raw)) continue;
    // Satır devamı: sondaki \ bir sonraki satırı ekler (aradaki yorum satırları atlanır)
    while (/\\\s*$/.test(raw) && i < lines.length) {
      raw = raw.replace(/\\\s*$/, ' ');
      let next = lines[i++]!;
      while (/^\s*#/.test(next) && i < lines.length) next = lines[i++]!;
      raw += /^\s*#/.test(next) ? '' : next.trim();
    }
    raw = raw
      .replace(/\\\s*$/, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
    const m = /^([A-Za-z]+)\s*(.*)$/.exec(raw);
    const word = (m?.[1] ?? raw).toUpperCase();
    const args = (m?.[2] ?? '').trim();
    if (!(INSTRUCTIONS as readonly string[]).includes(word)) {
      errors.push({ line: startLine, code: 'unknown-instruction', text: m?.[1] ?? raw });
      continue;
    }
    const kind = word as InstructionKind;
    if (!args) {
      errors.push({ line: startLine, code: 'missing-args', text: kind });
      continue;
    }
    if (kind === 'FROM') {
      const fm = /^(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?\s*$/i.exec(args);
      const base = fm?.[1] ?? args;
      const name = fm?.[2];
      const baseStage = stages.findIndex(
        (s) => s.name && s.name.toLowerCase() === base.toLowerCase(),
      );
      stages.push({
        index: stages.length,
        name,
        base,
        baseStage: baseStage === -1 ? undefined : baseStage,
        line: startLine,
        instructions: [],
      });
    } else if (stages.length === 0 && kind !== 'ARG') {
      errors.push({ line: startLine, code: 'before-from', text: kind });
      continue;
    }
    const ins: Instruction = {
      line: startLine,
      kind,
      args,
      stage: Math.max(0, stages.length - 1),
      createsLayer: LAYER_INSTRUCTIONS.includes(kind),
    };
    instructions.push(ins);
    if (kind !== 'FROM' && stages.length > 0) stages[stages.length - 1]!.instructions.push(ins);
  }
  if (stages.length === 0) errors.push({ line: 1, code: 'empty', text: 'FROM' });
  return { stages, instructions, errors };
}

/* ------------------------------------------------------------------ */
/* COPY/ADD kaynakları                                                 */
/* ------------------------------------------------------------------ */

export interface CopySpec {
  from?: string;
  sources: string[];
  dest: string;
}

export function parseCopy(args: string): CopySpec {
  let rest = args.trim();
  let from: string | undefined;
  // --from=..., --chown=..., --chmod=..., --link gibi bayraklar
  for (;;) {
    const f = /^--([a-z-]+)(?:=(\S+))?\s+/i.exec(rest);
    if (!f) break;
    if (f[1]!.toLowerCase() === 'from') from = f[2];
    rest = rest.slice(f[0].length);
  }
  let parts: string[];
  if (rest.startsWith('[')) {
    try {
      parts = (JSON.parse(rest) as unknown[]).map(String);
    } catch {
      parts = rest.split(/\s+/);
    }
  } else parts = rest.split(/\s+/).filter(Boolean);
  const dest = parts.length > 1 ? parts[parts.length - 1]! : '.';
  return { from, sources: parts.length > 1 ? parts.slice(0, -1) : parts, dest };
}

/** Bağımlılık bildirimi dosyaları: bunlar değişince bağımlılıklar yeniden kurulmalıdır */
const DEPS_FILE =
  /(^|\/)(package(-lock)?\.json|package\*\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|requirements[\w.-]*\.txt|pyproject\.toml|poetry\.lock|Pipfile(\.lock)?|go\.(mod|sum)|Gemfile(\.lock)?|composer\.(json|lock)|Cargo\.(toml|lock))$/i;

export type SourceKind = 'deps' | 'src' | 'all' | 'remote';

/** Bir COPY/ADD kaynağının hangi dosya grubuna dokunduğu */
export function classifySource(src: string): SourceKind {
  const s = src.replace(/^\.\//, '');
  if (/^https?:\/\//i.test(s)) return 'remote';
  if (s === '.' || s === '' || s === '*' || s === './') return 'all';
  if (DEPS_FILE.test(s)) return 'deps';
  return 'src';
}

/* ------------------------------------------------------------------ */
/* Boyut tahmini                                                        */
/* ------------------------------------------------------------------ */

/** Yaygın taban imajların yaklaşık açılmış boyutları (MB); eşleşme sırası önemlidir */
const BASE_SIZES: [RegExp, number][] = [
  [/^scratch$/i, 0],
  [/distroless/i, 25],
  [/^(docker\.io\/)?(library\/)?alpine(:|$)/i, 8],
  [/^node:.*alpine/i, 135],
  [/^node:.*slim/i, 220],
  [/^node(:|$)/i, 1100],
  [/^python:.*alpine/i, 55],
  [/^python:.*slim/i, 130],
  [/^python(:|$)/i, 1000],
  [/^nginx:.*alpine/i, 48],
  [/^nginx(:|$)/i, 190],
  [/^(golang|go):.*alpine/i, 260],
  [/^golang(:|$)/i, 820],
  [/^ubuntu(:|$)/i, 78],
  [/^debian:.*slim/i, 75],
  [/^debian(:|$)/i, 120],
  [/^(eclipse-)?temurin|openjdk/i, 450],
];
export const UNKNOWN_BASE_MB = 150;

export function baseImageSize(image: string): number {
  for (const [re, mb] of BASE_SIZES) if (re.test(image)) return mb;
  return UNKNOWN_BASE_MB;
}

const isDepsInstall = (cmd: string) =>
  /\b(npm (ci|install|i)\b|yarn( install)?\b|pnpm (install|i)\b|pip3? install\b|poetry install\b|bundle install\b|go mod download\b|composer install\b)/i.test(
    cmd,
  );
const hasAptInstall = (cmd: string) => /\bapt(-get)? +(-\S+ +)*install\b/i.test(cmd);
const hasAptCleanup = (cmd: string) => /rm +-rf +\/var\/lib\/apt\/lists/i.test(cmd);

/** Bir RUN komutunun tahmini katman boyutu (MB) */
export function estimateRun(cmd: string): number {
  let mb = 0;
  if (hasAptInstall(cmd)) mb += hasAptCleanup(cmd) ? 160 : 200;
  else if (/\bapt(-get)? +update\b/i.test(cmd)) mb += hasAptCleanup(cmd) ? 0 : 40;
  if (/\bapk +add\b/i.test(cmd)) mb += /--no-cache/.test(cmd) ? 12 : 16;
  if (/\b(npm (ci|install|i)|yarn( install)?|pnpm (install|i))\b/i.test(cmd))
    mb += /--omit[= ]dev|--production|--prod\b/i.test(cmd) ? 60 : 180;
  if (/\bpip3? install\b/i.test(cmd)) mb += /--no-cache-dir/.test(cmd) ? 90 : 130;
  if (/\bpoetry install\b/i.test(cmd)) mb += 120;
  if (/\b(npm|yarn|pnpm) run build\b|\bnext build\b|\btsc\b/i.test(cmd)) mb += 25;
  if (/\bgo build\b/i.test(cmd)) mb += 30;
  return mb || 1;
}

export interface SizeOptions {
  /** COPY . . ile kopyalanan build context'in boyutu (MB) */
  contextMb: number;
}

/** COPY/ADD için tahmini boyut; --from kopyaları kaynak aşamanın ürettiği çıktıya göre */
export function estimateCopy(spec: CopySpec, opts: SizeOptions): number {
  let mb = 0;
  for (const s of spec.sources) {
    if (spec.from) {
      mb += /node_modules|site-packages|venv/i.test(s)
        ? 180
        : /dist|build|out|bin/i.test(s)
          ? 8
          : 4;
      continue;
    }
    const kind = classifySource(s);
    mb +=
      kind === 'deps'
        ? 0.5
        : kind === 'all'
          ? opts.contextMb
          : kind === 'remote'
            ? 10
            : Math.max(1, opts.contextMb * 0.25);
  }
  return Math.round(mb * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Cache simülasyonu                                                    */
/* ------------------------------------------------------------------ */

export type ChangeKind = 'none' | 'deps' | 'src' | 'run';
export interface Change {
  kind: ChangeKind;
  /** kind === 'run' iken değişen RUN satırı */
  line?: number;
}

export type CacheStatus = 'cached' | 'rebuilt' | 'skipped';

export interface LayerInfo {
  instruction: Instruction;
  sizeMb: number;
  status: CacheStatus;
  /** Bu adım cache'i ilk bozan adım mı (zincirin başladığı yer) */
  cause: boolean;
  /** Final imajda yer alıyor mu */
  inFinal: boolean;
}

export interface StageInfo {
  stage: Stage;
  baseMb: number;
  /** Final imajın atası mı (FROM zinciri) ya da COPY --from ile kullanılıyor mu */
  used: boolean;
  inFinal: boolean;
  rebuilt: boolean;
}

export interface BuildPlan {
  layers: LayerInfo[];
  stages: StageInfo[];
  /** Final imaj tahmini boyutu (MB): taban + final aşama zincirindeki katmanlar */
  finalMb: number;
  /** Final imajdaki dosya sistemi katmanı sayısı (taban hariç) */
  finalLayers: number;
  /** Yeniden derlenen katman sayısı / boyutu (tüm aşamalar) */
  rebuiltLayers: number;
  rebuiltMb: number;
  /** İlk bozulan adımın satırı */
  firstMiss?: number;
}

function stageRef(parsed: ParsedDockerfile, ref: string): number | undefined {
  const byName = parsed.stages.findIndex((s) => s.name?.toLowerCase() === ref.toLowerCase());
  if (byName !== -1) return byName;
  if (/^\d+$/.test(ref) && Number(ref) < parsed.stages.length) return Number(ref);
  return undefined;
}

/**
 * Cache kuralları (BuildKit'in sadeleştirilmiş modeli):
 *  - Her aşamada adımlar sırayla kontrol edilir; bir adım cache'i kaçırırsa aynı aşamadaki sonraki tüm
 *    adımlar da yeniden çalışır (katman, üstündeki katmanın üzerine kurulur).
 *  - COPY/ADD: kopyalanan dosyalardan biri değiştiyse kaçırır (`COPY . .` her değişiklikten etkilenir).
 *  - RUN: komut metni değişmedikçe cache'ten gelir — dosyalar değişse bile! (Bu yüzden sıra önemlidir.)
 *  - COPY --from=aşama: kaynak aşama yeniden derlendiyse kaçırır.
 *  - FROM önceki-aşama: o aşama yeniden derlendiyse tüm aşama baştan derlenir.
 *  - Final imaj son aşamadır; ona FROM ya da COPY --from ile bağlı olmayan aşamalar atlanır.
 */
export function planBuild(parsed: ParsedDockerfile, change: Change, opts: SizeOptions): BuildPlan {
  const n = parsed.stages.length;
  const finalIdx = n - 1;
  // Kullanılan aşamalar: finalden geriye FROM ve COPY --from bağımlılıkları
  const used = new Set<number>();
  const visit = (k: number) => {
    if (k < 0 || used.has(k)) return;
    used.add(k);
    const st = parsed.stages[k]!;
    if (st.baseStage !== undefined) visit(st.baseStage);
    for (const ins of st.instructions) {
      if (ins.kind !== 'COPY' && ins.kind !== 'ADD') continue;
      const spec = parseCopy(ins.args);
      if (spec.from) {
        const ref = stageRef(parsed, spec.from);
        if (ref !== undefined && ref < k) visit(ref);
      }
    }
  };
  visit(finalIdx);
  // Final imaj zinciri: final aşama ve FROM ile miras aldığı aşamalar
  const finalChain = new Set<number>();
  for (
    let k: number | undefined = finalIdx;
    k !== undefined && k >= 0;
    k = parsed.stages[k]!.baseStage
  )
    finalChain.add(k);

  const stageRebuilt: boolean[] = [];
  const layers: LayerInfo[] = [];
  let firstMiss: number | undefined;

  parsed.stages.forEach((st, k) => {
    const isUsed = used.has(k);
    let missed = st.baseStage !== undefined ? (stageRebuilt[st.baseStage] ?? false) : false;
    let any = missed;
    for (const ins of st.instructions) {
      let size = 0;
      let invalidates = false;
      if (ins.kind === 'RUN') {
        size = estimateRun(ins.args);
        invalidates = change.kind === 'run' && change.line === ins.line;
      } else if (ins.kind === 'COPY' || ins.kind === 'ADD') {
        const spec = parseCopy(ins.args);
        size = estimateCopy(spec, opts);
        if (spec.from) {
          const ref = stageRef(parsed, spec.from);
          invalidates = ref !== undefined && (stageRebuilt[ref] ?? false);
        } else {
          const kinds = spec.sources.map(classifySource);
          invalidates =
            (change.kind === 'deps' && kinds.some((x) => x === 'deps' || x === 'all')) ||
            (change.kind === 'src' && kinds.some((x) => x === 'src' || x === 'all'));
        }
      }
      const cause = !missed && invalidates && isUsed;
      if (invalidates) missed = true;
      if (missed && isUsed) any = true;
      if (cause && firstMiss === undefined) firstMiss = ins.line;
      layers.push({
        instruction: ins,
        sizeMb: ins.createsLayer ? size : 0,
        status: !isUsed ? 'skipped' : missed ? 'rebuilt' : 'cached',
        cause,
        inFinal: finalChain.has(k) && ins.createsLayer,
      });
    }
    stageRebuilt[k] = any && isUsed;
  });

  const stages: StageInfo[] = parsed.stages.map((st, k) => ({
    stage: st,
    baseMb: st.baseStage !== undefined ? 0 : baseImageSize(st.base),
    used: used.has(k),
    inFinal: finalChain.has(k),
    rebuilt: stageRebuilt[k] ?? false,
  }));
  const finalLayersList = layers.filter((x) => x.inFinal);
  const rootBase = [...finalChain].sort((a, b) => a - b)[0];
  const baseMb = rootBase !== undefined ? baseImageSize(parsed.stages[rootBase]!.base) : 0;
  const rebuilt = layers.filter((x) => x.status === 'rebuilt' && x.instruction.createsLayer);
  const round = (x: number) => Math.round(x * 10) / 10;
  return {
    layers,
    stages,
    finalMb: round(baseMb + finalLayersList.reduce((s, x) => s + x.sizeMb, 0)),
    finalLayers: finalLayersList.length,
    rebuiltLayers: rebuilt.length,
    rebuiltMb: round(rebuilt.reduce((s, x) => s + x.sizeMb, 0)),
    firstMiss,
  };
}

/* ------------------------------------------------------------------ */
/* Uyarılar                                                             */
/* ------------------------------------------------------------------ */

export type WarningCode =
  | 'copy-all-before-install'
  | 'apt-no-cleanup'
  | 'apt-update-alone'
  | 'latest-tag'
  | 'root-user'
  | 'merge-runs'
  | 'secret-in-env'
  | 'add-local'
  | 'pip-cache';

export interface DockerWarning {
  code: WarningCode;
  line: number;
  severity: 'danger' | 'warning' | 'info';
  /** Uyarıya konu olan değer (imaj adı, değişken adı...) */
  detail?: string;
}

const SECRET_NAME = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY)/i;

export function lintDockerfile(parsed: ParsedDockerfile): DockerWarning[] {
  const out: DockerWarning[] = [];
  const stageNames = new Set(parsed.stages.map((s) => s.name?.toLowerCase()).filter(Boolean));

  for (const st of parsed.stages) {
    // Taban imaj etiketi
    if (
      st.baseStage === undefined &&
      !stageNames.has(st.base.toLowerCase()) &&
      st.base !== 'scratch'
    ) {
      const ref = st.base.split('@')[0]!;
      const tag = /:([^/:]+)$/.exec(ref)?.[1];
      if (!st.base.includes('@') && (!tag || tag === 'latest'))
        out.push({ code: 'latest-tag', line: st.line, severity: 'warning', detail: st.base });
    }

    const ins = st.instructions;
    // COPY . . bağımlılık kurulumundan önce → her kod değişikliği kurulumu yeniden çalıştırır
    const install = ins.find((x) => x.kind === 'RUN' && isDepsInstall(x.args));
    if (install) {
      const copyAll = ins.find(
        (x) =>
          (x.kind === 'COPY' || x.kind === 'ADD') &&
          x.line < install.line &&
          !parseCopy(x.args).from &&
          parseCopy(x.args).sources.some((s) => classifySource(s) === 'all'),
      );
      if (copyAll)
        out.push({ code: 'copy-all-before-install', line: copyAll.line, severity: 'warning' });
    }

    let runStreak: Instruction[] = [];
    const flush = () => {
      if (runStreak.length >= 2)
        out.push({
          code: 'merge-runs',
          line: runStreak[0]!.line,
          severity: 'info',
          detail: String(runStreak.length),
        });
      runStreak = [];
    };
    for (const x of ins) {
      if (x.kind === 'RUN') {
        if (hasAptInstall(x.args) && !hasAptCleanup(x.args))
          out.push({ code: 'apt-no-cleanup', line: x.line, severity: 'warning' });
        if (/\bapt(-get)? +update\b/i.test(x.args) && !hasAptInstall(x.args))
          out.push({ code: 'apt-update-alone', line: x.line, severity: 'warning' });
        if (/\bpip3? install\b/i.test(x.args) && !/--no-cache-dir/.test(x.args))
          out.push({ code: 'pip-cache', line: x.line, severity: 'info' });
        runStreak.push(x);
      } else {
        flush();
      }
      if (x.kind === 'ENV' || x.kind === 'ARG') {
        const names = [...x.args.matchAll(/(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)(?==|\s|$)/g)].map(
          (m) => m[1]!,
        );
        const secret = names.find((nm) => SECRET_NAME.test(nm));
        if (secret && /=/.test(x.args))
          out.push({ code: 'secret-in-env', line: x.line, severity: 'danger', detail: secret });
      }
      if (x.kind === 'ADD') {
        const spec = parseCopy(x.args);
        if (
          spec.sources.every(
            (s) => classifySource(s) !== 'remote' && !/\.(tar|tgz|tar\.\w+)$/i.test(s),
          )
        )
          out.push({ code: 'add-local', line: x.line, severity: 'info' });
      }
    }
    flush();
  }

  // Final aşamada USER yoksa ya da root ise konteyner root olarak çalışır
  const final = parsed.stages[parsed.stages.length - 1];
  if (final) {
    // FROM zincirindeki USER talimatları da geçerlidir
    const chain: Stage[] = [];
    for (
      let s: Stage | undefined = final;
      s;
      s = s.baseStage !== undefined ? parsed.stages[s.baseStage] : undefined
    )
      chain.unshift(s);
    const users = chain.flatMap((s) => s.instructions.filter((x) => x.kind === 'USER'));
    const last = users[users.length - 1];
    if (!last || /^(root|0)(:|$)/.test(last.args.trim()))
      out.push({ code: 'root-user', line: last?.line ?? final.line, severity: 'danger' });
  }
  return out.sort((a, b) => a.line - b.line);
}

/* ------------------------------------------------------------------ */
/* Hazır örnekler                                                       */
/* ------------------------------------------------------------------ */

export interface DockerExample {
  dockerfile: string;
  /** Karşılaştırma için ikinci sürüm: iyileştirilmiş ya da bilinçli olarak kötü */
  alternative: { label: { tr: string; en: string }; dockerfile: string };
}

export const EXAMPLES: Record<DockerExampleId, DockerExample> = {
  'node-basic': {
    dockerfile: `# Çalışıyor ama yavaş derlenen, büyük ve root olarak çalışan bir imaj
FROM node:latest
RUN apt-get update
RUN apt-get install -y curl
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
ENV API_TOKEN=dev-token-123
EXPOSE 3000
CMD ["node", "dist/server.js"]
`,
    alternative: {
      label: { tr: 'İyileştirilmiş sürüm', en: 'Improved version' },
      dockerfile: `# Sabit etiket, küçük taban, cache dostu sıra, root olmayan kullanıcı
FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Gizli bilgi imaja gömülmez; çalışma anında ortam değişkeni ya da secret olarak verilir
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
`,
    },
  },
  'node-multistage': {
    dockerfile: `# 1. aşama: derleme (devDependencies + kaynak kod burada kalır)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. aşama: çalıştırma (yalnızca üretim bağımlılıkları ve derlenmiş çıktı)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
`,
    alternative: {
      label: { tr: 'Tek aşamalı sürüm', en: 'Single-stage version' },
      dockerfile: `# Aynı uygulama tek aşamada: derleme araçları ve devDependencies imajda kalır
FROM node:22
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
`,
    },
  },
  'python-cached': {
    dockerfile: `FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update \\
    && apt-get install -y --no-install-recommends build-essential \\
    && rm -rf /var/lib/apt/lists/*
# Önce yalnızca bağımlılık listesi: kod değişince pip install cache'ten gelir
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --create-home appuser
USER appuser
EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
`,
    alternative: {
      label: { tr: 'Cache dostu olmayan sürüm', en: 'Cache-unfriendly version' },
      dockerfile: `FROM python:3.12
WORKDIR /app
COPY . .
RUN apt-get update
RUN apt-get install -y build-essential
RUN pip install -r requirements.txt
EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
`,
    },
  },
};
