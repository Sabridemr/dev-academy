import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import BigOPlotterSim from './BigOPlotterSim';

describe('BigOPlotterSim', () => {
  it('parametredeki fonksiyonları gösterir, düğmeyle açılıp kapanır', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <BigOPlotterSim params={{ functions: 'n,n2', maxN: 64 }} onInteract={onInteract} />,
    );
    const n2 = screen.getByRole('button', { name: /O\(n²\)/ });
    expect(n2).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /O\(2ⁿ\)/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // 1 saniye bütçesinde n² için en büyük n = 31
    expect(screen.getByText('31')).toBeInTheDocument();
    fireEvent.click(n2);
    expect(onInteract).toHaveBeenCalled();
    expect(n2).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('31')).not.toBeInTheDocument();
  });
});
