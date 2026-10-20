import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import BruteforceLoginSim from './BruteforceLoginSim';
import {
  attemptsWithin,
  crackProbability,
  expectedCrackSeconds,
  formatDuration,
  lockDuration,
  spaceFromLength,
  timeForAttempts,
  timeline,
  totalLockTime,
  type BruteforceConfig,
} from './bruteforceLogin.logic';

const cfg = (over: Partial<BruteforceConfig> = {}): BruteforceConfig => ({
  attemptsPerSecond: 10,
  lockoutAfter: 0,
  lockoutSeconds: 0,
  passwordSpace: 1000,
  backoff: false,
  mfa: false,
  ...over,
});

describe('bruteforceLogin.logic', () => {
  it('kilitsiz: beklenen süre = (uzay/2) / hız', () => {
    expect(expectedCrackSeconds(cfg())).toBeCloseTo(50);
  });

  it('sabit kilit: her eşikte kilit süresi eklenir (son denemeden sonraki hariç)', () => {
    const c = cfg({ lockoutAfter: 5, lockoutSeconds: 60 });
    // 10 deneme: 1 sn deneme + 1 kilit
    expect(timeForAttempts(c, 10)).toBeCloseTo(1 + 60);
    expect(expectedCrackSeconds(c)).toBeCloseTo(50 + 99 * 60);
  });

  it('artan gecikme: kilitler ikiye katlanır ve 24 saatte sınırlanır', () => {
    const c = cfg({ lockoutAfter: 5, lockoutSeconds: 60, backoff: true });
    expect([1, 2, 3].map((k) => lockDuration(c, k))).toEqual([60, 120, 240]);
    expect(lockDuration(c, 30)).toBe(86_400);
    // kapalı biçim = döngüyle toplam
    let sum = 0;
    for (let k = 1; k <= 40; k++) sum += lockDuration(c, k);
    expect(totalLockTime(c, 40)).toBeCloseTo(sum);
    expect(expectedCrackSeconds(c)).toBeGreaterThan(expectedCrackSeconds({ ...c, backoff: false }));
  });

  it('MFA ve uzunluk uzayı büyütür', () => {
    expect(expectedCrackSeconds(cfg({ mfa: true }))).toBeCloseTo(50 * 1e6);
    expect(spaceFromLength(10, 4)).toBe(10_000);
    expect(spaceFromLength(62, 8)).toBeGreaterThan(2e14);
  });

  it('attemptsWithin timeForAttempts’in tersidir; olasılık 1 ile sınırlı', () => {
    const c = cfg({ lockoutAfter: 5, lockoutSeconds: 30, passwordSpace: 1e6 });
    const t = timeForAttempts(c, 1234);
    expect(attemptsWithin(c, t)).toBeCloseTo(1234, 0);
    expect(crackProbability(cfg(), 1e9)).toBe(1);
  });

  it('zaman çizelgesi saldırı ve kilit dönemlerini sırayla üretir', () => {
    const segs = timeline(cfg({ lockoutAfter: 3, lockoutSeconds: 10, backoff: true }), 3);
    expect(segs.map((s) => s.kind)).toEqual(['attack', 'lock', 'attack', 'lock', 'attack', 'lock']);
    expect(segs.filter((s) => s.kind === 'lock').map((s) => s.duration)).toEqual([10, 20, 40]);
    expect(timeline(cfg())).toHaveLength(1);
  });

  it('süreleri okunur biçimlendirir', () => {
    expect(formatDuration(30, 'en')).toBe('30 s');
    expect(formatDuration(7200, 'tr')).toBe('2 sa');
    expect(formatDuration(1e30, 'en')).toMatch(/universe/);
  });
});

describe('BruteforceLoginSim', () => {
  it('parametrelerden hesaplar; MFA açılınca süre uzar', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <BruteforceLoginSim
        params={{ attemptsPerSecond: 10, lockoutAfter: 0, lockoutSeconds: 0, passwordSpace: 1000 }}
        onInteract={onInteract}
      />,
    );
    expect(screen.getByTestId('bf-expected')).toHaveTextContent('50 sn');
    fireEvent.click(screen.getByLabelText(/MFA/));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByTestId('bf-expected')).toHaveTextContent(/yıl/);
    expect(screen.getByText(/Eğitim amaçlı matematiksel model/)).toBeInTheDocument();
  });
});
