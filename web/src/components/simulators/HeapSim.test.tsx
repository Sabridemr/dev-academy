import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import HeapSim from './HeapSim';

const arrayValues = () =>
  within(screen.getByRole('list', { name: 'Dizi görünümü' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

describe('HeapSim', () => {
  it('parametredeki diziyi heapify ile kurar', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <HeapSim params={{ kind: 'min', initial: '5, 3, 1' }} onInteract={onInteract} />,
    );
    expect(arrayValues()).toEqual(['05', '13', '21']);
    fireEvent.click(screen.getByRole('button', { name: /Sona git/ }));
    expect(arrayValues()).toEqual(['01', '13', '25']);
    expect(screen.getByText('sağlanıyor')).toBeInTheDocument();
  });

  it('ekleme sift-up adımlarını gösterir', () => {
    renderWithProviders(
      <HeapSim params={{ kind: 'max', initial: '9, 4, 7' }} onInteract={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sona git/ }));
    fireEvent.change(screen.getByLabelText('Değer'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /^Ekle$/ }));
    // Test ortamında hareket azaltılmamış: oynatma başlar; adım adım ilerlet
    fireEvent.click(screen.getByRole('button', { name: /Duraklat/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Adım$/ }));
    expect(screen.getByText(/12 dizinin sonuna \(\[3\]\) eklendi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sona git/ }));
    expect(arrayValues()[0]).toBe('012');
  });

  it('düğüme odaklanınca ağaç ve dizide aynı indeks vurgulanır', () => {
    renderWithProviders(<HeapSim params={{ initial: '1, 2, 3' }} onInteract={() => undefined} />);
    const cell = screen.getAllByLabelText(/^\[1\] = 2/);
    expect(cell).toHaveLength(2);
    fireEvent.focus(cell[1]);
    expect(cell[1].className).toContain('border-primary');
  });
});
