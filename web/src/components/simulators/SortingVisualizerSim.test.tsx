import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import SortingVisualizerSim from './SortingVisualizerSim';

describe('SortingVisualizerSim', () => {
  it('adım düğmesi ilk karşılaştırmayı gösterir ve onInteract çağırır', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <SortingVisualizerSim params={{ algorithm: 'bubble', size: 8 }} onInteract={onInteract} />,
    );
    expect(screen.getByText(/Adım 0 \//)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Adım/ }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByText(/Adım 1 \//)).toBeInTheDocument();
    expect(screen.getByText(/\[0\]=\d+ ile \[1\]=\d+ karşılaştırılıyor/)).toBeInTheDocument();
  });

  it('parametreden algoritmayı alır ve bilgi kartını gösterir', () => {
    renderWithProviders(
      <SortingVisualizerSim params={{ algorithm: 'merge' }} onInteract={() => undefined} />,
    );
    expect(screen.getAllByText('Merge sort').length).toBeGreaterThan(0);
    expect(screen.getByText('Yazma')).toBeInTheDocument();
    expect(screen.getAllByText('O(n log n) / O(n log n) / O(n log n)').length).toBe(1);
  });
});
