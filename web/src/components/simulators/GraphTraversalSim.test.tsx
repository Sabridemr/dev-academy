import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import GraphTraversalSim from './GraphTraversalSim';

describe('GraphTraversalSim', () => {
  it('adım atınca başlangıç düğümü işlenir', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <GraphTraversalSim
        params={{ algorithm: 'bfs', nodes: 6, start: 'C' }}
        onInteract={onInteract}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adım/ }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByText('C işleniyor')).toBeInTheDocument();
  });

  it('düğüme tıklamak başlangıcı değiştirir', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <GraphTraversalSim
        params={{ algorithm: 'dijkstra', nodes: 5, weighted: true }}
        onInteract={onInteract}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'D' }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'D (başlangıç)' })).toBeInTheDocument();
    expect(screen.getByText('Öncelik kuyruğu')).toBeInTheDocument();
  });
});
