import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import DockerLayersSim from './DockerLayersSim';

const rowStatus = (container: HTMLElement, line: number) =>
  container.querySelector(`[data-line="${line}"]`)?.getAttribute('data-status');

describe('DockerLayersSim', () => {
  it('src/ değişince COPY . . ve sonrası yeniden derlenir, uyarılar listelenir', () => {
    const onInteract = vi.fn();
    const { container } = renderWithProviders(
      <DockerLayersSim params={{ example: 'node-basic' }} onInteract={onInteract} />,
    );
    // Güvenlik uyarıları görünür
    expect(screen.getByText(/USER yok: konteyner root olarak çalışır/)).toBeInTheDocument();
    expect(screen.getByText(/Gizli bilgi ENV\/ARG ile imaja gömülüyor/)).toBeInTheDocument();
    expect(screen.getByText('Tüm adımlar cache’ten geldi.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /src\/ değişti/ }));
    expect(onInteract).toHaveBeenCalled();
    // node-basic: 6. satır COPY . . → 7. satır npm install da yeniden
    expect(rowStatus(container, 4)).toBe('cached');
    expect(rowStatus(container, 6)).toBe('rebuilt');
    expect(rowStatus(container, 7)).toBe('rebuilt');
    expect(screen.getByText(/Cache 6\. satırda bozuldu/)).toBeInTheDocument();
  });

  it('iyileştirilmiş sürüm yüklenince önce/sonra karşılaştırması ve uyarılar güncellenir', () => {
    const { container } = renderWithProviders(
      <DockerLayersSim params={{ example: 'node-basic' }} onInteract={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Yükle: İyileştirilmiş sürüm/ }));
    expect(screen.getByText(/Uyarı yok/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /src\/ değişti/ }));
    // npm ci (6. satır) artık cache'ten gelir
    expect(rowStatus(container, 6)).toBe('cached');
    expect(rowStatus(container, 7)).toBe('rebuilt');
  });

  it('çok aşamalı örnekte derleme aşaması final imaja girmez', () => {
    renderWithProviders(
      <DockerLayersSim params={{ example: 'node-multistage' }} onInteract={() => undefined} />,
    );
    expect(screen.getByText('final imaja girmez')).toBeInTheDocument();
    expect(screen.getByText('final imaj')).toBeInTheDocument();
  });

  it('RUN satırı değişikliğini seçilen satıra uygular ve hatalı talimatı bildirir', () => {
    const { container } = renderWithProviders(
      <DockerLayersSim params={{ example: 'python-cached' }} onInteract={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /RUN satırı değişti/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Değişen RUN satırı' }), {
      target: { value: '9' },
    });
    expect(rowStatus(container, 8)).toBe('cached');
    expect(rowStatus(container, 9)).toBe('rebuilt');
    expect(rowStatus(container, 10)).toBe('rebuilt');
    fireEvent.change(screen.getByRole('textbox', { name: 'Dockerfile' }), {
      target: { value: 'FROM alpine:3.20\nRUNN echo' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('bilinmeyen talimat');
  });
});
