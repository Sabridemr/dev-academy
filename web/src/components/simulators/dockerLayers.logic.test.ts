import { describe, expect, it } from 'vitest';
import {
  DOCKER_EXAMPLES,
  EXAMPLES,
  classifySource,
  estimateRun,
  lintDockerfile,
  parseCopy,
  parseDockerfile,
  planBuild,
  type Change,
} from './dockerLayers.logic';

const opts = { contextMb: 40 };
const plan = (text: string, change: Change = { kind: 'none' }) =>
  planBuild(parseDockerfile(text), change, opts);
const statusByLine = (text: string, change: Change) =>
  Object.fromEntries(plan(text, change).layers.map((l) => [l.instruction.line, l.status]));
const codes = (text: string) => lintDockerfile(parseDockerfile(text)).map((w) => w.code);

const GOOD = `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
USER node
CMD ["node", "dist/server.js"]`;

const BAD_ORDER = `FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
USER node
CMD ["node", "dist/server.js"]`;

describe('parseDockerfile', () => {
  it('talimatları, satır devamlarını ve katman üreten adımları ayırır', () => {
    const p = parseDockerfile(`# yorum
ARG NODE_VERSION=22
FROM node:22-alpine AS build
RUN apk add --no-cache git \\
    # ara yorum
    && echo ok
COPY . .
ENV A=1
FROM build AS test
LABEL team=web
`);
    expect(p.errors).toEqual([]);
    expect(p.stages.map((s) => [s.name, s.base, s.baseStage])).toEqual([
      ['build', 'node:22-alpine', undefined],
      ['test', 'build', 0],
    ]);
    const run = p.instructions.find((i) => i.kind === 'RUN')!;
    expect(run.line).toBe(4);
    expect(run.args).toBe('apk add --no-cache git && echo ok');
    expect(p.instructions.filter((i) => i.createsLayer).map((i) => i.kind)).toEqual([
      'RUN',
      'COPY',
    ]);
    expect(p.instructions.find((i) => i.kind === 'LABEL')!.stage).toBe(1);
  });

  it('bilinmeyen talimatı ve FROM öncesi talimatı hata sayar', () => {
    const p = parseDockerfile('RUN echo x\nFROM alpine:3.20\nFOO bar\nCOPY');
    expect(p.errors.map((e) => [e.line, e.code])).toEqual([
      [1, 'before-from'],
      [3, 'unknown-instruction'],
      [4, 'missing-args'],
    ]);
    expect(parseDockerfile('# boş').errors[0]!.code).toBe('empty');
  });

  it('COPY bayraklarını ve kaynak türlerini çözer', () => {
    expect(parseCopy('--from=build --chown=node:node /app/dist ./dist')).toEqual({
      from: 'build',
      sources: ['/app/dist'],
      dest: './dist',
    });
    expect(parseCopy('["package.json", "yarn.lock", "./"]').sources).toEqual([
      'package.json',
      'yarn.lock',
    ]);
    expect(classifySource('package*.json')).toBe('deps');
    expect(classifySource('requirements.txt')).toBe('deps');
    expect(classifySource('.')).toBe('all');
    expect(classifySource('./src')).toBe('src');
    expect(classifySource('https://example.com/a.tgz')).toBe('remote');
  });
});

describe('cache geçersizleştirme', () => {
  it('değişiklik yokken her şey cache’ten gelir', () => {
    const p = plan(GOOD);
    expect(p.rebuiltLayers).toBe(0);
    expect(p.firstMiss).toBeUndefined();
    expect(p.layers.every((l) => l.status === 'cached')).toBe(true);
  });

  it('kaynak kod değişince doğru sıralı Dockerfile’da npm ci cache’ten gelir', () => {
    const s = statusByLine(GOOD, { kind: 'src' });
    expect(s).toMatchObject({ 3: 'cached', 4: 'cached', 5: 'rebuilt', 6: 'rebuilt', 7: 'rebuilt' });
    expect(plan(GOOD, { kind: 'src' }).firstMiss).toBe(5);
  });

  it('COPY . . kurulumdan önceyse kaynak değişikliği npm ci’yi de yeniden çalıştırır', () => {
    const s = statusByLine(BAD_ORDER, { kind: 'src' });
    expect(s).toMatchObject({ 2: 'cached', 3: 'rebuilt', 4: 'rebuilt', 5: 'rebuilt' });
    const good = plan(GOOD, { kind: 'src' });
    const bad = plan(BAD_ORDER, { kind: 'src' });
    expect(bad.rebuiltMb).toBeGreaterThan(good.rebuiltMb);
  });

  it('bağımlılık dosyası değişince package.json kopyasından itibaren bozulur', () => {
    const s = statusByLine(GOOD, { kind: 'deps' });
    expect(s).toMatchObject({ 2: 'cached', 3: 'rebuilt', 4: 'rebuilt', 5: 'rebuilt' });
  });

  it('RUN satırı değişince o satır ve sonrası yeniden derlenir, öncesi cache’te kalır', () => {
    const s = statusByLine(GOOD, { kind: 'run', line: 6 });
    expect(s).toMatchObject({ 3: 'cached', 4: 'cached', 5: 'cached', 6: 'rebuilt', 7: 'rebuilt' });
    const layers = plan(GOOD, { kind: 'run', line: 6 }).layers;
    expect(layers.filter((l) => l.cause).map((l) => l.instruction.line)).toEqual([6]);
  });

  it('çok aşamalı derlemede COPY --from kaynak aşama yeniden derlenince bozulur; final yalnızca son aşamayı içerir', () => {
    const text = EXAMPLES['node-multistage'].dockerfile;
    const parsed = parseDockerfile(text);
    const src = planBuild(parsed, { kind: 'src' }, opts);
    const byLine = Object.fromEntries(
      src.layers.map((l) => [l.instruction.kind + l.instruction.line, l]),
    );
    // build aşaması: COPY . . ve npm run build yeniden; runtime: npm ci --omit=dev cache, COPY --from yeniden
    expect(byLine.RUN5!.status).toBe('cached');
    expect(byLine.COPY6!.status).toBe('rebuilt');
    expect(byLine.RUN14!.status).toBe('cached');
    expect(byLine.COPY15!.status).toBe('rebuilt');
    expect(byLine.COPY15!.cause).toBe(true);
    // build aşamasının katmanları final imaja girmez
    expect(byLine.RUN5!.inFinal).toBe(false);
    expect(byLine.RUN14!.inFinal).toBe(true);
    expect(src.stages.map((s) => [s.used, s.inFinal])).toEqual([
      [true, false],
      [true, true],
    ]);
    // Final imaj tek aşamalı sürümden çok daha küçük
    const single = plan(EXAMPLES['node-multistage'].alternative.dockerfile);
    expect(src.finalMb).toBeLessThan(single.finalMb / 3);
  });

  it('FROM önceki-aşama zinciri ve kullanılmayan aşamalar', () => {
    const text = `FROM node:22-alpine AS deps
COPY package.json .
RUN npm ci
FROM node:22-alpine AS lint
COPY . .
RUN npm run lint
FROM deps AS final
COPY . .
USER node`;
    const p = plan(text, { kind: 'deps' });
    expect(p.stages.map((s) => s.used)).toEqual([true, false, true]);
    const st = Object.fromEntries(p.layers.map((l) => [l.instruction.line, l.status]));
    expect(st).toMatchObject({
      2: 'rebuilt',
      3: 'rebuilt',
      5: 'skipped',
      6: 'skipped',
      8: 'rebuilt',
    });
    // deps aşamasının katmanları FROM zinciriyle final imajda
    expect(p.layers.find((l) => l.instruction.line === 3)!.inFinal).toBe(true);
  });
});

describe('boyut tahmini', () => {
  it('kural tabanlı RUN boyutları mertebe olarak doğru sıralanır', () => {
    expect(estimateRun('apt-get update && apt-get install -y curl')).toBeGreaterThan(
      estimateRun('apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*'),
    );
    expect(estimateRun('npm ci')).toBeGreaterThan(estimateRun('npm ci --omit=dev'));
    expect(estimateRun('echo hi')).toBe(1);
  });

  it('COPY . . boyutu build context parametresine bağlıdır', () => {
    const small = planBuild(parseDockerfile(BAD_ORDER), { kind: 'none' }, { contextMb: 5 });
    const big = planBuild(parseDockerfile(BAD_ORDER), { kind: 'none' }, { contextMb: 300 });
    expect(big.finalMb - small.finalMb).toBeCloseTo(295, 0);
  });
});

describe('uyarılar', () => {
  it('kötü örnekte beklenen tüm uyarıları üretir', () => {
    expect(new Set(codes(EXAMPLES['node-basic'].dockerfile))).toEqual(
      new Set([
        'latest-tag',
        'apt-update-alone',
        'apt-no-cleanup',
        'merge-runs',
        'copy-all-before-install',
        'secret-in-env',
        'root-user',
      ]),
    );
  });

  it('iyileştirilmiş ve çok aşamalı örnekler temizdir', () => {
    expect(codes(EXAMPLES['node-basic'].alternative.dockerfile)).toEqual([]);
    expect(codes(EXAMPLES['node-multistage'].dockerfile)).toEqual([]);
    expect(codes(EXAMPLES['python-cached'].dockerfile)).toEqual([]);
  });

  it('etiketler, aşama adları ve USER kuralları', () => {
    expect(codes('FROM alpine\nUSER app')).toEqual(['latest-tag']);
    expect(codes('FROM alpine@sha256:abc\nUSER app')).toEqual([]);
    expect(codes('FROM node:22 AS b\nFROM b\nUSER root')).toEqual(['root-user']);
    // USER FROM zincirinden miras alınır
    expect(codes('FROM node:22 AS b\nUSER node\nFROM b')).toEqual([]);
    expect(codes('FROM python:3.12\nRUN pip install flask\nUSER x')).toEqual(['pip-cache']);
    expect(codes('FROM alpine:3.20\nADD app.py /app/\nUSER x')).toEqual(['add-local']);
  });

  it('her hazır örnek hatasız ayrışır', () => {
    for (const id of DOCKER_EXAMPLES) {
      expect(parseDockerfile(EXAMPLES[id].dockerfile).errors).toEqual([]);
      expect(parseDockerfile(EXAMPLES[id].alternative.dockerfile).errors).toEqual([]);
    }
  });
});
