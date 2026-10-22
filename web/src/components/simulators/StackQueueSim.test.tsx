import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import StackQueueSim from './StackQueueSim';

describe('StackQueueSim', () => {
  it('parantez modu: hatalı ifadede hata konumunu gösterir', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <StackQueueSim params={{ mode: 'brackets', expression: '(a]' }} onInteract={onInteract} />,
    );
    const step = screen.getByRole('button', { name: /^Adım$/ });
    fireEvent.click(step);
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByText(/'\(' \(konum 0\) yığına itildi/)).toBeInTheDocument();
    fireEvent.click(step);
    expect(screen.getByText(/Hata, konum 2: '\]' geldi, '\)' bekleniyordu/)).toBeInTheDocument();
  });

  it('BFS modu: kuyruk ve ziyaret sırası ilerler', () => {
    renderWithProviders(
      <StackQueueSim params={{ mode: 'bfs-queue' }} onInteract={() => undefined} />,
    );
    const step = screen.getByRole('button', { name: /^Adım$/ });
    fireEvent.click(step);
    expect(screen.getByText('Başlangıç A kuyruğa eklendi.')).toBeInTheDocument();
    fireEvent.click(step);
    expect(screen.getByText('A kuyruğun başından alındı ve ziyaret edildi.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sona git/ }));
    expect(screen.getByText('A → B → C → D → E → F → G')).toBeInTheDocument();
  });

  it('mod düğmesi aria-pressed ile seçili modu belirtir', () => {
    renderWithProviders(<StackQueueSim params={{}} onInteract={() => undefined} />);
    const bfs = screen.getByRole('button', { name: 'BFS kuyruğu' });
    expect(bfs).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(bfs);
    expect(bfs).toHaveAttribute('aria-pressed', 'true');
  });
});
