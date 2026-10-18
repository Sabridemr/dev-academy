import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import LoadBalancerSim from './LoadBalancerSim';

describe('LoadBalancerSim', () => {
  it('istek gönderince kabul sayacı artar ve karar günlüğü dolar', () => {
    vi.useFakeTimers();
    const onInteract = vi.fn();
    renderWithProviders(
      <LoadBalancerSim params={{ algorithm: 'round-robin', servers: 3 }} onInteract={onInteract} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /İstek gönder/ }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByText(/Round-robin sıradaki: s1/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('parametrelerden başlangıç sunucu sayısını alır', () => {
    renderWithProviders(<LoadBalancerSim params={{ servers: 5 }} onInteract={() => undefined} />);
    expect(screen.getByText('S5')).toBeInTheDocument();
  });
});
