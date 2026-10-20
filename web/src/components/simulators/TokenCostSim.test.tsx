import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import TokenCostSim from './TokenCostSim';
import { PRICES, contextFill, dailyCost, requestCost, scenarios } from './tokenCost.logic';

describe('tokenCost.logic', () => {
  it('istek maliyeti girdi ve çıktı fiyatlarından hesaplanır', () => {
    // 1M girdi + 1M çıktı = girdi fiyatı + çıktı fiyatı
    expect(requestCost('mid', 1_000_000, 1_000_000)).toBeCloseTo(
      PRICES.mid.input + PRICES.mid.output,
    );
    expect(requestCost('large', 2000, 0)).toBeCloseTo((2000 * PRICES.large.input) / 1e6);
    // tam önbellek: girdi önbellek fiyatından
    expect(requestCost('mid', 1_000_000, 0, 1)).toBeCloseTo(PRICES.mid.cachedInput);
  });

  it('günlük maliyet istek sayısıyla doğrusal', () => {
    const u = { inputTokens: 1000, outputTokens: 200, requestsPerDay: 100 };
    expect(dailyCost('small', { ...u, requestsPerDay: 200 })).toBeCloseTo(
      2 * dailyCost('small', u),
    );
  });

  it('önbellek ve yönlendirme tasarruf sağlar; ikisi birlikte en ucuzu', () => {
    const s = scenarios(
      'large',
      { inputTokens: 4000, outputTokens: 500, requestsPerDay: 1000 },
      { cacheablePrefix: 0.5, cacheHitRate: 1, routedShare: 0.5 },
    );
    const by = Object.fromEntries(s.map((x) => [x.id, x]));
    expect(by.baseline.savings).toBe(0);
    expect(by.cache.daily).toBeLessThan(by.baseline.daily);
    expect(by.routing.daily).toBeLessThan(by.baseline.daily);
    expect(by.both.daily).toBeLessThan(Math.min(by.cache.daily, by.routing.daily));
    expect(by.baseline.monthly).toBeCloseTo(by.baseline.daily * 30);
  });

  it('küçük model seçiliyken yönlendirme tasarrufu sıfır', () => {
    const s = scenarios(
      'small',
      { inputTokens: 1000, outputTokens: 100, requestsPerDay: 10 },
      { cacheablePrefix: 0, cacheHitRate: 0, routedShare: 1 },
    );
    expect(s.find((x) => x.id === 'routing')!.savings).toBeCloseTo(0);
  });

  it('bağlam doluluğu pencereye oranlanır', () => {
    expect(contextFill('small', 16_000, 0)).toBeCloseTo(0.5);
    expect(contextFill('small', 40_000, 0)).toBeGreaterThan(1);
  });
});

describe('TokenCostSim', () => {
  it('örnek fiyat uyarısı ve senaryolar görünür; pencere aşımı uyarılır', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <TokenCostSim
        params={{ model: 'small', inputTokens: 40000, outputTokens: 1000, requestsPerDay: 100 }}
        onInteract={onInteract}
      />,
    );
    expect(screen.getByText(/Örnek fiyatlar/)).toBeInTheDocument();
    expect(screen.getByText('Prompt önbelleği')).toBeInTheDocument();
    expect(screen.getByText(/Bağlam penceresi aşıldı/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'large' } });
    expect(onInteract).toHaveBeenCalled();
    expect(screen.queryByText(/Bağlam penceresi aşıldı/)).not.toBeInTheDocument();
  });
});
