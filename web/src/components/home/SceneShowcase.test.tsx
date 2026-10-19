import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { parseScene } from '@devacademy/shared';
import example from '@devacademy/shared/examples/load-balancer-round-robin.scene.json';
import { renderWithProviders } from '@/test/utils';
import { SceneShowcase } from './SceneShowcase';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const lb = parseScene(example);
const second = parseScene({ ...example, id: 'ikinci-sahne', title: { tr: 'İkinci sahne' } });

describe('SceneShowcase', () => {
  it('sekmeyle sahne değişir, ders bağlantısı seçili sahneyi izler', () => {
    renderWithProviders(
      <SceneShowcase
        scenes={[
          { scene: lb, lessonId: 'a-05-load-balancing', label: { tr: 'Load Balancer' } },
          { scene: second, lessonId: 'a-07-caching', label: { tr: 'Önbellek' } },
        ]}
      />,
    );
    // Oynatıcının kendi adım sekmeleri de var: vitrinin sekme listesine sınırla
    const showcase = () => within(screen.getByRole('tablist', { name: 'Örnek animasyonlar' }));
    const tabs = showcase().getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: /dersine git/ })).toHaveAttribute(
      'href',
      '/lessons/a-05-load-balancing',
    );

    fireEvent.click(tabs[1]);
    expect(showcase().getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('figure', { name: /İkinci sahne/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dersine git/ })).toHaveAttribute(
      'href',
      '/lessons/a-07-caching',
    );

    // Ok tuşlarıyla sekmeler arasında gezinilir (döngüsel)
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Örnek animasyonlar' }), {
      key: 'ArrowRight',
    });
    expect(showcase().getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('sahne gelmezse paketlenmiş örneği sekmesiz gösterir', () => {
    renderWithProviders(<SceneShowcase scenes={[]} />);
    expect(screen.queryByRole('tablist', { name: 'Örnek animasyonlar' })).not.toBeInTheDocument();
    expect(screen.getByRole('figure', { name: /Round-Robin/ })).toBeInTheDocument();
  });
});
