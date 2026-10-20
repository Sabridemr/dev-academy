import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import GitGraphSim from './GitGraphSim';

describe('GitGraphSim', () => {
  it('merge düğmesi komut günlüğüne yazar ve onInteract çağırır', () => {
    const onInteract = vi.fn();
    renderWithProviders(<GitGraphSim params={{ scenario: 'merge' }} onInteract={onInteract} />);
    fireEvent.click(screen.getByRole('button', { name: /^merge$/ }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByText('$ git merge feature')).toBeInTheDocument();
    expect(screen.getByText("Merge made by the 'ort' strategy.")).toBeInTheDocument();
  });

  it('conflict senaryosunda uyarı ve çözüm adımı gösterir', () => {
    renderWithProviders(
      <GitGraphSim params={{ scenario: 'conflict' }} onInteract={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^rebase$/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Çakışma: app.js');
    expect(screen.getByRole('button', { name: /^merge$/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Çakışmayı çöz/ }));
    expect(screen.getByText('$ git rebase --continue')).toBeInTheDocument();
  });
});
