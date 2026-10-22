import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import DpTableSim from './DpTableSim';

describe('DpTableSim', () => {
  it('adım adım doldurur, formülü gösterir ve onInteract çağırır', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <DpTableSim params={{ problem: 'fibonacci', size: 5 }} onInteract={onInteract} />,
    );
    const step = screen.getByRole('button', { name: /^Adım$/ });
    fireEvent.click(step);
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByText(/dp\[0\] = 0 \(taban durum\)/)).toBeInTheDocument();
    fireEvent.click(step);
    fireEvent.click(step);
    expect(screen.getByText(/dp\[2\] = dp\[1\] \+ dp\[0\] = 1 \+ 0 = 1/)).toBeInTheDocument();
  });

  it('tablo odaktayken sağ ok ile ilerler, sona gidince çözümü gösterir', () => {
    renderWithProviders(
      <DpTableSim params={{ problem: 'coin-change', size: 6 }} onInteract={() => undefined} />,
    );
    fireEvent.keyDown(screen.getByRole('group', { name: /DP tablosu/ }), { key: 'ArrowRight' });
    expect(screen.getByText(/dp\[0\] = 0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sona git/ }));
    expect(screen.getByText('Geri izleme (çözüm)')).toBeInTheDocument();
    expect(screen.getByText('3 + 3')).toBeInTheDocument();
  });

  it('LCS seçilince iki dizgi alanı çıkar, boyut kaydırıcısı gizlenir', () => {
    renderWithProviders(<DpTableSim params={{ problem: 'lcs' }} onInteract={() => undefined} />);
    expect(screen.getByLabelText('Dizgi A (satırlar)')).toHaveValue('ABCBDAB');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});
