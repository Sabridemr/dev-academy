import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { parseScene } from '@devacademy/shared';
import example from '@devacademy/shared/examples/load-balancer-round-robin.scene.json';
import { renderWithProviders } from '@/test/utils';
import { ScenePlayer } from './ScenePlayer';

const scene = parseScene(example);

describe('ScenePlayer', () => {
  it('ilk adımı ve anlatımı gösterir', () => {
    renderWithProviders(<ScenePlayer scene={scene} />);
    expect(screen.getByText('Adım 1/5 · Başlangıç')).toBeInTheDocument();
    const live = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).toHaveTextContent(/tek bir adrese/);
  });

  it('adım ileri/geri düğmeleri adımı değiştirir', () => {
    renderWithProviders(<ScenePlayer scene={scene} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adım ileri' }));
    expect(screen.getByText(/Adım 2\/5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adım geri' }));
    expect(screen.getByText(/Adım 1\/5/)).toBeInTheDocument();
  });

  it('klavye ile kontrol edilir (→)', () => {
    renderWithProviders(<ScenePlayer scene={scene} />);
    const fig = screen.getByRole('figure');
    act(() => {
      fireEvent.keyDown(fig, { key: 'ArrowRight' });
      fireEvent.keyDown(fig, { key: 'ArrowRight' });
    });
    expect(screen.getByText(/Adım 3\/5/)).toBeInTheDocument();
  });

  it('odak bir düğmedeyken klavye kısayolu düğmenin yerine çalışmaz', () => {
    renderWithProviders(<ScenePlayer scene={scene} />);
    const next = screen.getByRole('button', { name: 'Adım ileri' });
    act(() => {
      fireEvent.keyDown(next, { key: 'ArrowRight' });
      fireEvent.keyDown(next, { key: ' ' });
    });
    expect(screen.getByText(/Adım 1\/5/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Duraklat|Pause/ })).not.toBeInTheDocument();
  });

  it('adım çizelgesinden atlanabilir ve anlatım gizlenebilir', async () => {
    renderWithProviders(<ScenePlayer scene={scene} />);
    fireEvent.click(screen.getByRole('tab', { name: /4\./ }));
    expect(screen.getByText(/Adım 4\/5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Açıklamayı gizle' }));
    // AnimatePresence çıkış animasyonu bitince kaldırılır
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')).toBeNull());
  });

  it('metin alternatifi (transkript) tüm adımları içerir', () => {
    renderWithProviders(<ScenePlayer scene={scene} />);
    expect(screen.getByText('Metin alternatifi')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(scene.steps.length);
  });

  it('İngilizce dilde İngilizce anlatımı kullanır', () => {
    renderWithProviders(<ScenePlayer scene={scene} />, 'en');
    expect(screen.getByText('Step 1/5 · Start')).toBeInTheDocument();
  });
});
