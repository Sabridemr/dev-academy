import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import HashTableSim from './HashTableSim';
import { hashString } from './hashTable.logic';

describe('HashTableSim', () => {
  it('anahtar ekleyince kovada görünür ve günlüğe yazılır', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <HashTableSim params={{ buckets: 8, collision: 'chaining' }} onInteract={onInteract} />,
    );
    fireEvent.change(screen.getByPlaceholderText('ör. elma'), { target: { value: 'elma' } });
    fireEvent.click(screen.getByRole('button', { name: /Ekle/ }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getAllByText('elma').length).toBeGreaterThan(0);
    expect(
      screen.getByText(`put("elma") hash=${hashString('elma')} → kova ${hashString('elma') % 8}`),
    ).toBeInTheDocument();
  });

  it('yük faktörü aşılınca yeniden boyutlandırır', () => {
    renderWithProviders(
      <HashTableSim
        params={{ buckets: 4, collision: 'linear-probing', loadFactor: 0.5 }}
        onInteract={() => undefined}
      />,
    );
    const random = screen.getByRole('button', { name: /Rastgele ekle/ });
    fireEvent.click(random);
    fireEvent.click(random);
    fireEvent.click(random);
    expect(screen.getByText(/rehash 4 → 8/)).toBeInTheDocument();
  });
});
