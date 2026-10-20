/**
 * RAG hattının saf mantığı: parçalama, TF-IDF gömme, kosinüs benzerliği, en yakın k parça ve
 * bağlamdan cümle seçerek deterministik cevap derleme. Ağ ya da model çağrısı yoktur.
 */

export interface RagDoc {
  id: string;
  title: string;
  text: string;
}

export interface Chunk {
  id: string;
  docId: string;
  index: number;
  text: string;
  start: number;
  end: number;
}

export type SparseVector = Map<string, number>;

export interface RagIndex {
  chunks: Chunk[];
  idf: Map<string, number>;
  vectors: SparseVector[];
}

export interface RagHit {
  chunk: Chunk;
  score: number;
  rank: number;
}

const STOPWORDS = new Set([
  // tr
  'bir',
  've',
  'ile',
  'bu',
  'şu',
  'da',
  'de',
  'mi',
  'mı',
  'mu',
  'mü',
  'için',
  'ise',
  'ya',
  'veya',
  'olan',
  'olarak',
  'gibi',
  'en',
  'çok',
  'daha',
  'her',
  'ne',
  'kaç',
  'nasıl',
  'hangi',
  'var',
  'yok',
  'ki',
  'ben',
  'biz',
  'siz',
  'o',
  // en
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'is',
  'are',
  'be',
  'with',
  'at',
  'by',
  'it',
  'this',
  'that',
  'do',
  'does',
  'i',
  'we',
  'you',
  'how',
  'what',
  'which',
  'can',
  'my',
  'have',
  'has',
  'many',
  'much',
  'from',
  'as',
  'if',
  'within',
]);

/** Basit F5 kökleme: kelimenin ilk 5 harfi (Türkçe bilgi erişiminde bilinen kaba ama etkili yöntem) */
export const STEM_LENGTH = 5;

/** Metni küçük harfe çevirip harf/rakam dizilerine böler, durak kelimeleri atar, kökler */
export function tokenize(text: string): string[] {
  const words = text.toLocaleLowerCase('tr').match(/[\p{L}]+|\p{N}+/gu) ?? [];
  return words
    .filter((w) => !STOPWORDS.has(w))
    .map((w) => Array.from(w).slice(0, STEM_LENGTH).join(''));
}

/**
 * Karakter tabanlı parçalama, kelime sınırlarına saygılı. Her parça en fazla `size` karakterdir
 * (tek bir kelime daha uzunsa istisna); bir sonraki parça, öncekinin son `overlap` karakterini
 * kapsayan ilk kelimeden başlar. İlerleme her zaman garanti edilir.
 */
export function chunkText(text: string, size: number, overlap: number, docId = 'doc'): Chunk[] {
  const words = Array.from(text.matchAll(/\S+/g), (m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
  if (words.length === 0) return [];
  const chunkSize = Math.max(1, size);
  const ov = Math.max(0, Math.min(overlap, Math.floor(chunkSize / 2)));
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < words.length) {
    const start = words[i].start;
    let j = i;
    while (j + 1 < words.length && words[j + 1].end - start <= chunkSize) j++;
    const end = words[j].end;
    chunks.push({
      id: `${docId}#${chunks.length + 1}`,
      docId,
      index: chunks.length,
      text: text.slice(start, end),
      start,
      end,
    });
    if (j === words.length - 1) break;
    let next = j + 1;
    if (ov > 0) {
      while (next - 1 > i && words[next - 1].start >= end - ov) next--;
    }
    i = Math.max(i + 1, next);
  }
  return chunks;
}

export function chunkDocs(docs: RagDoc[], size: number, overlap: number): Chunk[] {
  return docs.flatMap((d) => chunkText(d.text, size, overlap, d.id));
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function normalize(v: SparseVector): SparseVector {
  let norm = 0;
  for (const x of v.values()) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  const out: SparseVector = new Map();
  for (const [k, x] of v) out.set(k, x / norm);
  return out;
}

/** Metni verilen IDF tablosuyla birim uzunlukta TF-IDF vektörüne gömer (bilinmeyen terimler atılır) */
export function embed(text: string, idf: Map<string, number>): SparseVector {
  const v: SparseVector = new Map();
  for (const [t, f] of termFreq(tokenize(text))) {
    const w = idf.get(t);
    if (w !== undefined) v.set(t, f * w);
  }
  return normalize(v);
}

/** Seyrek vektörler arası kosinüs benzerliği (vektörlerin birim olması gerekmez) */
export function cosine(a: SparseVector, b: SparseVector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, x] of a) {
    na += x * x;
    const y = b.get(k);
    if (y !== undefined) dot += x * y;
  }
  for (const y of b.values()) nb += y * y;
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** Yumuşatılmış IDF: ln((N+1)/(df+1)) + 1 */
export function buildIndex(chunks: Chunk[]): RagIndex {
  const df = new Map<string, number>();
  const tokenSets = chunks.map((c) => new Set(tokenize(c.text)));
  for (const s of tokenSets) for (const t of s) df.set(t, (df.get(t) ?? 0) + 1);
  const n = chunks.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((n + 1) / (d + 1)) + 1);
  return { chunks, idf, vectors: chunks.map((c) => embed(c.text, idf)) };
}

/** Sorguya en yakın k parça; eşit skorda belge sırası korunur */
export function retrieve(index: RagIndex, query: string, k: number): RagHit[] {
  const q = embed(query, index.idf);
  return index.chunks
    .map((chunk, i) => ({ chunk, score: cosine(q, index.vectors[i]), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, Math.max(1, k))
    .map((h, rank) => ({ chunk: h.chunk, score: h.score, rank: rank + 1 }));
}

/** Bir vektörün en ağırlıklı terimleri (görselleştirme için) */
export function topTerms(v: SparseVector, n = 4): { term: string; weight: number }[] {
  return [...v.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([term, weight]) => ({ term, weight }));
}

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 2);
}

export interface RagAnswer {
  sentences: { text: string; score: number; chunkId: string }[];
}

/**
 * "Üretim" adımının deterministik karşılığı: bağlamdaki cümleleri sorguyla kosinüs benzerliğine
 * göre puanlar ve en yüksek skorlu (sıfırdan büyük) `max` cümleyi döndürür. Tekrarlar elenir.
 */
export function composeAnswer(index: RagIndex, query: string, hits: RagHit[], max = 2): RagAnswer {
  const q = embed(query, index.idf);
  const seen = new Set<string>();
  const scored: { text: string; score: number; chunkId: string }[] = [];
  for (const h of hits) {
    for (const s of splitSentences(h.chunk.text)) {
      if (seen.has(s)) continue;
      seen.add(s);
      const score = cosine(q, embed(s, index.idf));
      if (score > 0) scored.push({ text: s, score, chunkId: h.chunk.id });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return { sentences: scored.slice(0, max) };
}

export const RAG_DOCS: Record<'tr' | 'en', RagDoc[]> = {
  tr: [
    {
      id: 'iade',
      title: 'İade politikası',
      text: 'Ürünleri teslim tarihinden itibaren 30 gün içinde iade edebilirsiniz. İade edilen ürün kullanılmamış ve orijinal ambalajında olmalıdır. İade onaylandıktan sonra ücret 5 iş günü içinde kartınıza yansır. Hijyen ürünleri ve kişiye özel siparişler iade kapsamı dışındadır.',
    },
    {
      id: 'kargo',
      title: 'Kargo ve teslimat',
      text: 'Siparişler hafta içi saat 15:00’e kadar verilirse aynı gün kargoya teslim edilir. Standart teslimat süresi 2 ile 4 iş günüdür. 500 TL ve üzeri siparişlerde kargo ücretsizdir. Kargo takip numarası e-posta ile gönderilir.',
    },
    {
      id: 'garanti',
      title: 'Garanti',
      text: 'Tüm elektronik ürünler 2 yıl üretici garantisine sahiptir. Garanti kapsamındaki arızalar için yetkili servis ücretsiz onarım yapar. Kullanıcı hatasından kaynaklanan hasarlar garanti kapsamına girmez. Garanti başvurusu için fatura saklanmalıdır.',
    },
    {
      id: 'destek',
      title: 'Müşteri desteği',
      text: 'Destek ekibine hafta içi 09:00 ile 18:00 arasında canlı sohbetten ulaşabilirsiniz. E-posta ile gelen talepler 24 saat içinde yanıtlanır. Acil teslimat sorunları için telefon hattı hafta sonu da açıktır.',
    },
  ],
  en: [
    {
      id: 'returns',
      title: 'Return policy',
      text: 'You can return items within 30 days of the delivery date. Returned items must be unused and in their original packaging. Once a return is approved, the refund reaches your card within 5 business days. Hygiene products and personalised orders cannot be returned.',
    },
    {
      id: 'shipping',
      title: 'Shipping and delivery',
      text: 'Orders placed before 3 pm on weekdays are shipped the same day. Standard delivery takes 2 to 4 business days. Shipping is free for orders of 50 USD or more. A tracking number is sent by email.',
    },
    {
      id: 'warranty',
      title: 'Warranty',
      text: 'All electronic products come with a 2 year manufacturer warranty. Authorised service repairs covered faults free of charge. Damage caused by user error is not covered by the warranty. Keep your invoice to file a warranty claim.',
    },
    {
      id: 'support',
      title: 'Customer support',
      text: 'You can reach the support team by live chat on weekdays between 9 am and 6 pm. Requests sent by email are answered within 24 hours. The phone line for urgent delivery issues is also open at weekends.',
    },
  ],
};

export const RAG_DEFAULT_QUERY = {
  tr: 'İade ettiğim ürünün ücreti kaç günde kartıma yansır?',
  en: 'How many days until the refund reaches my card?',
} as const;
