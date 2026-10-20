import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import RagPipelineSim from './RagPipelineSim';
import {
  RAG_DEFAULT_QUERY,
  RAG_DOCS,
  buildIndex,
  chunkDocs,
  chunkText,
  composeAnswer,
  cosine,
  embed,
  retrieve,
  tokenize,
} from './ragPipeline.logic';

const TEXT = RAG_DOCS.en[0].text;

describe('ragPipeline.logic', () => {
  it('parçalar boyut sınırına uyar ve tüm metni kapsar', () => {
    const chunks = chunkText(TEXT, 80, 0);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(80);
    expect(chunks[0].start).toBe(0);
    expect(chunks.at(-1)!.end).toBe(TEXT.length);
    // örtüşme yokken ardışık parçalar üst üste binmez
    for (let i = 1; i < chunks.length; i++)
      expect(chunks[i].start).toBeGreaterThan(chunks[i - 1].end - 1);
  });

  it('örtüşme ardışık parçalar arasında ortak metin bırakır', () => {
    const chunks = chunkText(TEXT, 100, 30);
    const overlapping = chunks.slice(1).filter((c, i) => c.start < chunks[i].end);
    expect(overlapping.length).toBeGreaterThan(0);
    // her durumda ilerleme var
    for (let i = 1; i < chunks.length; i++)
      expect(chunks[i].start).toBeGreaterThan(chunks[i - 1].start);
  });

  it('kosinüs: aynı vektör 1, ortak terim yoksa 0', () => {
    const a = new Map([
      ['x', 1],
      ['y', 2],
    ]);
    expect(cosine(a, a)).toBeCloseTo(1);
    expect(cosine(a, new Map([['z', 3]]))).toBe(0);
    expect(cosine(a, new Map())).toBe(0);
  });

  it('tokenize durak kelimeleri atar ve 5 harfe kökler', () => {
    expect(tokenize('The returned items')).toEqual(['retur', 'items']);
    expect(tokenize('İade ve ücret')).toEqual(['iade', 'ücret']);
  });

  it('varsayılan sorgu iade belgesini bulur ve cevabı oradan derler', () => {
    for (const loc of ['tr', 'en'] as const) {
      const index = buildIndex(chunkDocs(RAG_DOCS[loc], 160, 20));
      const hits = retrieve(index, RAG_DEFAULT_QUERY[loc], 3);
      expect(hits[0].chunk.docId).toBe(RAG_DOCS[loc][0].id);
      expect(hits[0].score).toBeGreaterThan(hits[2].score);
      const answer = composeAnswer(index, RAG_DEFAULT_QUERY[loc], hits);
      expect(answer.sentences[0].text).toMatch(loc === 'tr' ? /5 iş günü/ : /5 business days/);
    }
  });

  it('sözlükte olmayan sorgu boş vektör ve boş cevap verir', () => {
    const index = buildIndex(chunkDocs(RAG_DOCS.en, 160, 20));
    expect(embed('zzzz qqqq', index.idf).size).toBe(0);
    expect(composeAnswer(index, 'zzzz', retrieve(index, 'zzzz', 2)).sentences).toEqual([]);
  });
});

describe('RagPipelineSim', () => {
  it('varsayılan sorguya bağlamdan cevap derler; kaydırıcı onInteract çağırır', () => {
    const onInteract = vi.fn();
    renderWithProviders(<RagPipelineSim params={{ topK: 2 }} onInteract={onInteract} />);
    expect(screen.getByTestId('rag-answer')).toHaveTextContent(/5 iş günü/);
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '300' } });
    expect(onInteract).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Parçalar/ }));
    expect(screen.getByText(/Sarı bölgeler/)).toBeInTheDocument();
  });

  it('parametredeki sorguyu kullanır ve İngilizce belge setine geçer', () => {
    renderWithProviders(
      <RagPipelineSim
        params={{ query: 'Is shipping free?', chunkSize: 120 }}
        onInteract={() => undefined}
      />,
      'en',
    );
    expect(screen.getByDisplayValue('Is shipping free?')).toBeInTheDocument();
    expect(screen.getByTestId('rag-answer')).toHaveTextContent(/Shipping is free/);
  });
});
