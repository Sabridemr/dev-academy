import { buildSearchText } from './admin.service';

describe('buildSearchText', () => {
  it('başlık, özet, kavramlar ve metin bloklarını birleştirir; markdown işaretlerini temizler', () => {
    const text = buildSearchText(
      [
        { id: 't1', order: 0, type: 'text', markdown: '## **Yük** dengeleme' },
        { id: 'c1', order: 1, type: 'code', language: 'ts', code: 'const x = 1', alternatives: [], highlightLines: [], title: 'Round robin' },
        { id: 'i1', order: 2, type: 'interactive', interactive: 'load-balancer', params: {} },
        { id: 'q1', order: 3, type: 'quiz', src: 'quiz.json' },
      ],
      { tr: 'Load Balancer', en: 'Load Balancer EN' },
      'Özet',
      ['round-robin'],
    );
    expect(text).toContain('Load Balancer EN');
    expect(text).toContain('Yük dengeleme');
    expect(text).toContain('round-robin');
    expect(text).toContain('load-balancer');
    expect(text).toContain('Round robin');
    expect(text).not.toContain('**');
    expect(text).not.toContain('##');
  });
});
