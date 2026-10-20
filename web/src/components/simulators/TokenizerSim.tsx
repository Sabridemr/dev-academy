'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { Field, Range, SimShell, Stat } from './ui';
import { strParam, type SimulatorProps } from './types';

/** Küçük, yerleşik eğitim korpusu (TR + EN). Deterministik BPE eğitimi için sabit. */
const CORPUS = `
the model learns to predict the next token . the tokenizer splits text into tokens .
tokens are the units that the model reads and writes . unbelievable results need believable data .
learning rate controls how fast the model learns . the cat sat on the mat .
bu model bir sonraki tokeni tahmin etmeyi öğrenir . tokenizer metni tokenlere ayırır .
öğrenme oranı modelin ne kadar hızlı öğrendiğini belirler . fiyat bilgisi ve ürün kodu .
kelimeler alt parçalara bölünür ; sık geçen parçalar tek token olur . ürünler ürün ürünü ürünün .
istanbul ankara izmir . numbers like 2024 and 1000 and 12345 appear in text .
gelecek geliyor gelir geldi gelmek . running runner runs ran . lower lowest newer newest .
`;

const SPACE = '▁';
const MAX_MERGES = 250;

interface Merge {
  a: string;
  b: string;
  count: number;
}

const L = {
  tr: {
    title: 'Tokenizer: Byte-Pair Encoding (BPE)',
    input: 'Metin',
    merges: 'Birleştirme sayısı (vocab büyüklüğü)',
    table: 'Öğrenilen birleştirmeler (ilk 24)',
    tokens: 'BPE token',
    chars: 'Karakter düzeyi',
    words: 'Kelime düzeyi',
    ratio: 'Karakter / token',
    vocab: 'Sözlük boyutu',
    bytes: 'Byte fallback',
    hint: 'BPE karakterlerden başlar ve korpusta en sık yan yana gelen çifti tekrar tekrar birleştirir. ▁ boşluğu temsil eder. Korpusta hiç görülmeyen karakterler UTF-8 byte’larına düşer.',
    rank: '#',
    pair: 'Çift',
    result: 'Sonuç',
    freq: 'Frekans',
  },
  en: {
    title: 'Tokenizer: Byte-Pair Encoding (BPE)',
    input: 'Text',
    merges: 'Number of merges (vocab size)',
    table: 'Learned merges (first 24)',
    tokens: 'BPE tokens',
    chars: 'Character-level',
    words: 'Word-level',
    ratio: 'Chars / token',
    vocab: 'Vocab size',
    bytes: 'Byte fallback',
    hint: 'BPE starts from characters and repeatedly merges the most frequent adjacent pair in the corpus. ▁ marks a space. Characters never seen in the corpus fall back to UTF-8 bytes.',
    rank: '#',
    pair: 'Pair',
    result: 'Result',
    freq: 'Freq',
  },
};

/** Ön-tokenleştirme: boşluklar ▁ ile kelimenin başına eklenir, rakamlar ve noktalama ayrı tutulur */
function preTokenize(text: string): string[] {
  const out: string[] = [];
  const re = /(\s*)([\p{L}]+|\p{N}+|[^\s\p{L}\p{N}])/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push((m[1] ? SPACE : '') + m[2]);
  return out;
}

/** Deterministik BPE eğitimi: eşitlikte sözlükbilimsel olarak küçük çift seçilir */
function trainBpe(corpus: string, maxMerges: number): { base: string[]; merges: Merge[] } {
  const wordCounts = new Map<string, number>();
  for (const w of preTokenize(corpus.toLowerCase()))
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  let words = [...wordCounts.entries()].map(([w, c]) => ({ syms: Array.from(w), c }));
  const base = [...new Set(words.flatMap((w) => w.syms))].sort();
  const merges: Merge[] = [];
  for (let step = 0; step < maxMerges; step++) {
    const pairs = new Map<string, number>();
    for (const w of words) {
      for (let i = 0; i < w.syms.length - 1; i++) {
        const key = `${w.syms[i]}\u0000${w.syms[i + 1]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + w.c);
      }
    }
    let bestKey = '';
    let bestCount = 1; // tek geçen çiftleri birleştirmeyiz
    for (const [key, c] of pairs) {
      if (c > bestCount || (c === bestCount && bestKey !== '' && key < bestKey && c > 1)) {
        bestKey = key;
        bestCount = c;
      }
    }
    if (!bestKey) break;
    const [a, b] = bestKey.split('\u0000');
    merges.push({ a, b, count: bestCount });
    words = words.map((w) => {
      const syms: string[] = [];
      for (let i = 0; i < w.syms.length; i++) {
        if (i < w.syms.length - 1 && w.syms[i] === a && w.syms[i + 1] === b) {
          syms.push(a + b);
          i++;
        } else syms.push(w.syms[i]);
      }
      return { syms, c: w.c };
    });
  }
  return { base, merges };
}

interface Tok {
  text: string;
  id: number;
  byte: boolean;
}

/** Bir kelimeyi öğrenilmiş birleştirmeleri sıra (rank) önceliğiyle uygulayarak kodlar */
function encodeWord(
  word: string,
  ranks: Map<string, number>,
  vocab: Map<string, number>,
  baseSet: Set<string>,
): Tok[] {
  let syms = Array.from(word.toLowerCase());
  for (;;) {
    let bestRank = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < syms.length - 1; i++) {
      const r = ranks.get(`${syms[i]}\u0000${syms[i + 1]}`);
      if (r !== undefined && r < bestRank) {
        bestRank = r;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    syms = [
      ...syms.slice(0, bestIdx),
      syms[bestIdx] + syms[bestIdx + 1],
      ...syms.slice(bestIdx + 2),
    ];
  }
  const enc = new TextEncoder();
  return syms.flatMap((s): Tok[] => {
    const id = vocab.get(s);
    if (id !== undefined) return [{ text: s, id, byte: false }];
    if (s.length === 1 && !baseSet.has(s)) {
      // Bilinmeyen karakter → UTF-8 byte token'ları (id: 256 byte'lık blok, sözlüğün sonunda)
      return Array.from(enc.encode(s)).map((b) => ({
        text: `<0x${b.toString(16).toUpperCase().padStart(2, '0')}>`,
        id: 10_000 + b,
        byte: true,
      }));
    }
    return Array.from(s).map((ch) => ({
      text: ch,
      id: vocab.get(ch) ?? 10_000 + ch.charCodeAt(0),
      byte: !vocab.has(ch),
    }));
  });
}

const CHIP_TONES = [
  'var(--da-primary)',
  'var(--da-accent)',
  'var(--da-success)',
  'var(--da-danger)',
  'var(--da-warning)',
];

export default function TokenizerSim({ params, onInteract }: SimulatorProps) {
  const { locale } = useI18n();
  const l = L[locale];
  const [text, setText] = useState(() =>
    strParam<string>(
      params,
      'text',
      'Unbelievable! The model learns tokens. Ürünler 2024’te geliyor.',
    ),
  );
  const [mergeCount, setMergeCount] = useState(120);

  // Eğitim bir kez yapılır; kaydırıcı yalnızca ilk n birleştirmeyi kullanır
  const trained = useMemo(() => trainBpe(CORPUS, MAX_MERGES), []);
  const { ranks, vocab, baseSet } = useMemo(() => {
    const active = trained.merges.slice(0, mergeCount);
    const r = new Map(active.map((m, i) => [`${m.a}\u0000${m.b}`, i]));
    const v = new Map<string, number>();
    trained.base.forEach((ch) => v.set(ch, v.size));
    active.forEach((m) => {
      if (!v.has(m.a + m.b)) v.set(m.a + m.b, v.size);
    });
    return { ranks: r, vocab: v, baseSet: new Set(trained.base) };
  }, [trained, mergeCount]);

  const tokens = useMemo(
    () => preTokenize(text).flatMap((w) => encodeWord(w, ranks, vocab, baseSet)),
    [text, ranks, vocab, baseSet],
  );
  const charCount = Array.from(text).length;
  const wordCount = text.split(/[\s]+/).filter(Boolean).length;
  const byteCount = tokens.filter((tk) => tk.byte).length;

  return (
    <SimShell
      title={l.title}
      aside={
        <>
          <Range
            label={l.merges}
            value={mergeCount}
            min={0}
            max={trained.merges.length}
            onChange={(v) => {
              onInteract();
              setMergeCount(v);
            }}
          />
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <Stat label={l.tokens} value={tokens.length} tone="primary" />
            <Stat label={l.vocab} value={vocab.size} />
            <Stat label={l.chars} value={charCount} />
            <Stat label={l.words} value={wordCount} />
            <Stat
              label={l.ratio}
              value={tokens.length ? (charCount / tokens.length).toFixed(2) : '—'}
              tone="success"
            />
            <Stat label={l.bytes} value={byteCount} tone={byteCount ? 'warning' : undefined} />
          </div>
          <div>
            <p className="label">{l.table}</p>
            <div className="max-h-64 overflow-auto rounded-xl border border-border">
              <table className="w-full text-left font-mono text-xs">
                <thead className="sticky top-0 bg-elevated text-muted">
                  <tr>
                    <th className="px-2 py-1">{l.rank}</th>
                    <th className="px-2 py-1">{l.pair}</th>
                    <th className="px-2 py-1">{l.result}</th>
                    <th className="px-2 py-1 text-right">{l.freq}</th>
                  </tr>
                </thead>
                <tbody>
                  {trained.merges.slice(0, Math.min(24, mergeCount)).map((m, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-0.5 text-muted">{i + 1}</td>
                      <td className="px-2 py-0.5">
                        {m.a} + {m.b}
                      </td>
                      <td className="px-2 py-0.5 text-primary">{m.a + m.b}</td>
                      <td className="px-2 py-0.5 text-right">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      }
    >
      <Field label={l.input}>
        <textarea
          className="input min-h-[80px] font-mono"
          value={text}
          maxLength={400}
          onChange={(e) => {
            onInteract();
            setText(e.target.value);
          }}
        />
      </Field>
      <p className="mt-2 text-xs text-muted">{l.hint}</p>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label={l.tokens} aria-live="polite">
        {tokens.map((tk, i) => {
          const tone = tk.byte ? 'var(--da-warning)' : CHIP_TONES[i % CHIP_TONES.length];
          return (
            <span
              key={i}
              className="inline-flex flex-col items-center rounded-lg border px-1.5 py-0.5 font-mono text-xs"
              style={{
                borderColor: tone,
                background: `color-mix(in srgb, ${tone} 14%, var(--da-surface))`,
              }}
              title={`id ${tk.id}`}
            >
              <span className="whitespace-pre">{tk.text}</span>
              <span className="text-[9px] text-muted">{tk.id}</span>
            </span>
          );
        })}
      </div>
      {/* Üç düzeyin karşılaştırması */}
      <svg
        viewBox="0 0 600 96"
        className="mt-4 h-auto w-full"
        role="img"
        aria-label={`${l.chars} / ${l.tokens} / ${l.words}`}
      >
        {[
          { label: l.chars, v: charCount, c: 'var(--da-muted)' },
          { label: l.tokens, v: tokens.length, c: 'var(--da-primary)' },
          { label: l.words, v: wordCount, c: 'var(--da-success)' },
        ].map((b, i) => (
          <g key={b.label} transform={`translate(0, ${i * 30 + 4})`}>
            <text x={0} y={15} fontSize={11} fill="var(--da-fg)">
              {b.label}
            </text>
            <rect x={130} y={3} width={400} height={16} rx={5} fill="var(--da-elevated)" />
            <rect
              x={130}
              y={3}
              width={(400 * b.v) / Math.max(1, charCount)}
              height={16}
              rx={5}
              fill={b.c}
            />
            <text x={540} y={15} fontSize={11} fill="var(--da-muted)">
              {b.v}
            </text>
          </g>
        ))}
      </svg>
    </SimShell>
  );
}
