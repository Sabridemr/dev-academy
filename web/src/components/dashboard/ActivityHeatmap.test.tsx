import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ActivityHeatmap, buildHeatmapWeeks, intensity } from './ActivityHeatmap';

describe('buildHeatmapWeeks', () => {
  it('52 hafta × 7 gün üretir, son sütun bugünün haftasıdır ve eksik günler sıfırdır', () => {
    // 2026-10-20 Salı
    const weeks = buildHeatmapWeeks(
      [{ date: '2026-10-19', seconds: 1800, lessonsCompleted: 1, quizzesPassed: 0, xp: 50 }],
      '2026-10-20',
    );
    expect(weeks).toHaveLength(52);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const last = weeks[51];
    expect(last[0].date).toBe('2026-10-19'); // Pazartesi
    expect(last[0].level).toBe(3);
    expect(last[1].date).toBe('2026-10-20');
    expect(last[1].seconds).toBe(0);
    expect(last[1].future).toBe(false);
    expect(last[2].future).toBe(true);
    expect(weeks[0][0].date).toBe('2025-10-27');
  });

  it('yoğunluk seviyeleri dakikaya göre artar', () => {
    expect(intensity(0)).toBe(0);
    expect(intensity(0, 1)).toBe(1);
    expect(intensity(5 * 60)).toBe(1);
    expect(intensity(20 * 60)).toBe(2);
    expect(intensity(45 * 60)).toBe(3);
    expect(intensity(90 * 60)).toBe(4);
  });
});

describe('ActivityHeatmap', () => {
  it('her geçmiş gün için erişilebilir etiketli hücre çizer', () => {
    renderWithProviders(
      <ActivityHeatmap
        todayKey="2026-10-20"
        weeks={2}
        activity={[
          { date: '2026-10-19', seconds: 600, lessonsCompleted: 2, quizzesPassed: 1, xp: 0 },
        ]}
      />,
    );
    const cells = screen.getAllByRole('img');
    // 1 tam hafta + bu haftanın 2 günü
    expect(cells).toHaveLength(9);
    const active = cells.find((c) => c.getAttribute('data-date') === '2026-10-19');
    expect(active).toHaveAttribute('aria-label', expect.stringContaining('10 dk, 2 ders'));
    expect(active).toHaveAttribute('title');
  });
});
