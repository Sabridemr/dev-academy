'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Field, Range, SimShell, Stat } from './ui';
import { numParam, strParam, type SimulatorProps } from './types';
import {
  RAG_DEFAULT_QUERY,
  RAG_DOCS,
  buildIndex,
  chunkDocs,
  composeAnswer,
  embed,
  retrieve,
  topTerms,
  type Chunk,
} from './ragPipeline.logic';

const STAGES = ['docs', 'chunks', 'vectors', 'query', 'matches'] as const;
type Stage = (typeof STAGES)[number];

const L = {
  tr: {
    title: 'RAG hattı: parçala, göm, getir, cevapla',
    chunkSize: 'Parça boyutu (karakter)',
    overlap: 'Örtüşme (karakter)',
    topK: 'Getirilecek parça (k)',
    query: 'Sorgu',
    stages: {
      docs: 'Belge',
      chunks: 'Parçalar',
      vectors: 'Vektörler',
      query: 'Sorgu',
      matches: 'Eşleşmeler',
    } satisfies Record<Stage, string>,
    stageHint: {
      docs: 'Örnek bilgi tabanı: dört kısa paragraf. Gerçek sistemlerde binlerce belge olur.',
      chunks:
        'Metin kelime sınırlarında parçalara bölünür. Sarı bölgeler iki parçada birden geçen örtüşmedir; sınırda kalan bilginin kaybolmasını önler.',
      vectors:
        'Her parça TF-IDF ile seyrek bir vektöre gömülür: nadir terimler ağır basar. Kelimeler ilk 5 harflerine indirgenir (kaba kökleme).',
      query: 'Sorgu da aynı sözlük ve ağırlıklarla gömülür; sözlükte olmayan terimler yok sayılır.',
      matches:
        'Kosinüs benzerliği en yüksek k parça bağlam olur. Skor 0 ise parça sorguyla hiç terim paylaşmıyordur.',
    } satisfies Record<Stage, string>,
    next: 'Sonraki adım',
    chunks: 'Parça',
    vocab: 'Sözlük',
    best: 'En iyi skor',
    terms: 'Ağır terimler',
    score: 'Benzerlik',
    queryTerms: 'Sorgu vektörü',
    noTerms: 'Sorgudaki terimlerin hiçbiri belgelerde yok.',
    context: 'Bağlam (modele gönderilen)',
    answer: 'Derlenen cevap',
    answerNote:
      'Yerel ve deterministik: bir dil modeli yerine bağlamdaki en alakalı cümleler seçilir; köşeli parantez kaynağı gösterir.',
    noAnswer:
      'Bağlamda bu soruya yanıt bulunamadı. k’yı artırmayı, parça boyutunu değiştirmeyi ya da sorguyu yeniden yazmayı dene.',
    chars: 'karakter',
  },
  en: {
    title: 'RAG pipeline: chunk, embed, retrieve, answer',
    chunkSize: 'Chunk size (characters)',
    overlap: 'Overlap (characters)',
    topK: 'Chunks to retrieve (k)',
    query: 'Query',
    stages: {
      docs: 'Documents',
      chunks: 'Chunks',
      vectors: 'Vectors',
      query: 'Query',
      matches: 'Matches',
    } satisfies Record<Stage, string>,
    stageHint: {
      docs: 'A sample knowledge base: four short paragraphs. Real systems hold thousands of documents.',
      chunks:
        'Text is split on word boundaries. Yellow regions are overlap shared by two chunks; it keeps facts on a boundary from being lost.',
      vectors:
        'Each chunk is embedded as a sparse TF-IDF vector: rare terms weigh more. Words are cut to their first 5 letters (crude stemming).',
      query:
        'The query is embedded with the same vocabulary and weights; unknown terms are ignored.',
      matches:
        'The k chunks with the highest cosine similarity become the context. A score of 0 means no shared terms.',
    } satisfies Record<Stage, string>,
    next: 'Next step',
    chunks: 'Chunks',
    vocab: 'Vocabulary',
    best: 'Best score',
    terms: 'Top terms',
    score: 'Similarity',
    queryTerms: 'Query vector',
    noTerms: 'None of the query terms appear in the documents.',
    context: 'Context (sent to the model)',
    answer: 'Composed answer',
    answerNote:
      'Local and deterministic: instead of a language model, the most relevant context sentences are picked; brackets cite the source.',
    noAnswer:
      'The context does not answer this question. Try a larger k, a different chunk size or rephrase the query.',
    chars: 'characters',
  },
};

/** Belge metnini parça kapsamına göre bölümlere ayırır (örtüşme = iki parçanın kapsadığı bölge) */
function segments(text: string, chunks: Chunk[]) {
  const cuts = new Set<number>([0, text.length]);
  for (const c of chunks) {
    cuts.add(c.start);
    cuts.add(c.end);
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  const out: { text: string; cover: Chunk[] }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    out.push({ text: text.slice(a, b), cover: chunks.filter((c) => c.start <= a && c.end >= b) });
  }
  return out;
}

export default function RagPipelineSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const reduced = usePrefersReducedMotion();
  const docs = RAG_DOCS[locale];
  const [chunkSize, setChunkSize] = useState(() => numParam(params, 'chunkSize', 160, 50, 500));
  const [overlap, setOverlap] = useState(() => numParam(params, 'overlap', 20, 0, 100));
  const [topK, setTopK] = useState(() => numParam(params, 'topK', 3, 1, 6));
  const [query, setQuery] = useState<string>(() =>
    strParam(params, 'query', '').trim()
      ? strParam(params, 'query', '')
      : RAG_DEFAULT_QUERY[locale],
  );
  const [stage, setStage] = useState<Stage>('matches');

  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      onInteract();
      set(v);
    };

  const chunks = useMemo(() => chunkDocs(docs, chunkSize, overlap), [docs, chunkSize, overlap]);
  const index = useMemo(() => buildIndex(chunks), [chunks]);
  const scores = useMemo(
    () => retrieve(index, query, chunks.length),
    [index, query, chunks.length],
  );
  const hits = useMemo(() => scores.slice(0, topK), [scores, topK]);
  const hitIds = new Set(hits.filter((h) => h.score > 0).map((h) => h.chunk.id));
  const scoreById = new Map(scores.map((h) => [h.chunk.id, h.score]));
  const qVec = useMemo(() => embed(query, index.idf), [query, index]);
  const answer = useMemo(() => composeAnswer(index, query, hits), [index, query, hits]);
  const stageIdx = STAGES.indexOf(stage);
  const counts: Record<Stage, string> = {
    docs: String(docs.length),
    chunks: String(chunks.length),
    vectors: `${index.idf.size}d`,
    query: String(qVec.size),
    matches: String(hitIds.size),
  };

  const chunkTone = (c: Chunk) =>
    c.index % 2 === 0 ? 'bg-primary/10 decoration-primary' : 'bg-accent/15 decoration-accent';

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <Range
            label={l.chunkSize}
            value={chunkSize}
            min={50}
            max={500}
            step={10}
            onChange={touch(setChunkSize)}
          />
          <Range
            label={l.overlap}
            value={overlap}
            min={0}
            max={100}
            step={5}
            onChange={touch(setOverlap)}
          />
          <Range label={l.topK} value={topK} min={1} max={6} onChange={touch(setTopK)} />
          <Field label={l.query}>
            <textarea
              className="input min-h-[72px] resize-y"
              value={query}
              onChange={(e) => {
                onInteract();
                setQuery(e.target.value);
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={l.chunks} value={chunks.length} />
            <Stat label={l.vocab} value={index.idf.size} />
            <Stat
              label={l.best}
              value={(scores[0]?.score ?? 0).toFixed(2)}
              tone={(scores[0]?.score ?? 0) > 0.2 ? 'success' : 'warning'}
            />
            <Stat label="k" value={topK} tone="primary" />
          </div>
        </>
      }
    >
      {/* Hat şeridi: belge → parçalar → vektörler → sorgu → eşleşmeler */}
      <ol className="mb-3 flex flex-wrap items-center gap-1" aria-label={l.title}>
        {STAGES.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={stage === s}
              onClick={() => {
                onInteract();
                setStage(s);
              }}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                stage === s
                  ? 'border-primary bg-primary text-primary-fg'
                  : i <= stageIdx
                    ? 'border-primary/40 bg-primary/10 text-fg'
                    : 'border-border bg-surface text-muted',
              )}
            >
              {i + 1}. {l.stages[s]} <span className="tabular-nums opacity-80">({counts[s]})</span>
            </button>
            {i < STAGES.length - 1 && <ChevronRight size={14} className="text-muted" aria-hidden />}
          </li>
        ))}
        {stageIdx < STAGES.length - 1 && (
          <li className="ml-auto">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                onInteract();
                setStage(STAGES[stageIdx + 1]);
              }}
            >
              {l.next} <ArrowRight size={14} />
            </button>
          </li>
        )}
      </ol>
      <p className="mb-3 text-sm text-muted">{l.stageHint[stage]}</p>

      <motion.div
        key={stage}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        className="max-h-[360px] space-y-3 overflow-auto rounded-xl border border-border bg-surface/80 p-3"
      >
        {(stage === 'docs' || stage === 'chunks') &&
          docs.map((d) => {
            const own = chunks.filter((c) => c.docId === d.id);
            return (
              <article key={d.id}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {d.title}
                  {stage === 'chunks' && ` · ${own.length} ${l.chunks.toLowerCase()}`}
                </p>
                <p className="text-sm leading-relaxed">
                  {stage === 'docs'
                    ? d.text
                    : segments(d.text, own).map((seg, i) => (
                        <span
                          key={i}
                          title={seg.cover.map((c) => c.id).join(' + ')}
                          className={cn(
                            seg.cover.length >= 2
                              ? 'bg-warning/30'
                              : seg.cover.length === 1
                                ? chunkTone(seg.cover[0])
                                : '',
                            seg.cover.some((c) => hitIds.has(c.id)) &&
                              'underline decoration-2 underline-offset-4',
                          )}
                        >
                          {seg.text}
                        </span>
                      ))}
                </p>
              </article>
            );
          })}

        {(stage === 'vectors' || stage === 'matches') && (
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">{l.terms}</th>
                {stage === 'matches' && <th className="w-32 py-1 font-medium">{l.score}</th>}
              </tr>
            </thead>
            <tbody>
              {(stage === 'matches' ? scores.map((h) => h.chunk) : chunks).map((c) => {
                const s = scoreById.get(c.id) ?? 0;
                const isHit = hitIds.has(c.id);
                const vec = index.vectors[chunks.indexOf(c)];
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-t border-border',
                      stage === 'matches' && isHit && 'bg-success/10',
                    )}
                  >
                    <td className="py-1.5 pr-2 font-mono text-muted">{c.id}</td>
                    <td className="py-1.5 pr-2">
                      <span className="flex flex-wrap gap-1">
                        {topTerms(vec).map((t) => (
                          <span
                            key={t.term}
                            className={cn(
                              'rounded-md border px-1.5 py-0.5 font-mono',
                              qVec.has(t.term)
                                ? 'border-primary bg-primary/15 text-fg'
                                : 'border-border bg-elevated/60',
                            )}
                          >
                            {t.term} {t.weight.toFixed(2)}
                          </span>
                        ))}
                      </span>
                    </td>
                    {stage === 'matches' && (
                      <td className="py-1.5">
                        <span className="flex items-center gap-2">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.round(s * 100)}%`,
                                background: isHit ? 'var(--da-success)' : 'var(--da-muted)',
                              }}
                            />
                          </span>
                          <span className="w-10 text-right tabular-nums">{s.toFixed(2)}</span>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {stage === 'query' && (
          <div>
            <p className="mb-2 text-sm">“{query}”</p>
            <p className="label">{l.queryTerms}</p>
            {qVec.size === 0 ? (
              <p className="text-sm text-warning">{l.noTerms}</p>
            ) : (
              <span className="flex flex-wrap gap-1">
                {topTerms(qVec, 12).map((t) => (
                  <span
                    key={t.term}
                    className="rounded-md border border-primary bg-primary/15 px-1.5 py-0.5 font-mono text-xs"
                  >
                    {t.term} {t.weight.toFixed(2)}
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
      </motion.div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="label">{l.context}</p>
          <ol className="space-y-2" aria-label={l.context}>
            {hits.map((h) => (
              <li
                key={h.chunk.id}
                className={cn(
                  'rounded-xl border p-2 text-xs leading-relaxed',
                  h.score > 0 ? 'border-success/50 bg-success/5' : 'border-border text-muted',
                )}
              >
                <span className="mb-1 flex justify-between font-mono text-muted">
                  <span>
                    {h.rank}. {h.chunk.id}
                  </span>
                  <span className="tabular-nums">{h.score.toFixed(3)}</span>
                </span>
                {h.chunk.text}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="label">{l.answer}</p>
          <div
            className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm"
            aria-live="polite"
            data-testid="rag-answer"
          >
            {answer.sentences.length === 0 ? (
              <p className="text-warning">{l.noAnswer}</p>
            ) : (
              <p>
                {answer.sentences.map((s) => (
                  <span key={s.text}>
                    {s.text}{' '}
                    <span className="font-mono text-xs text-primary">[{s.chunkId}]</span>{' '}
                  </span>
                ))}
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">{l.answerNote}</p>
        </div>
      </div>
    </SimShell>
  );
}
