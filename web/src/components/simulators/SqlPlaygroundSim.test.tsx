import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { loadTestSqlJs } from '@/test/sqljs';
import SqlPlaygroundSim from './SqlPlaygroundSim';

// Tarayıcıdaki /sql.js/sql-wasm.wasm yerine node_modules'taki gerçek motor
vi.mock('./sqlEngine', () => ({ loadSqlEngine: () => loadTestSqlJs() }));

const editor = () => screen.getByRole('textbox', { name: 'SQL sorgusu' }) as HTMLTextAreaElement;

describe('SqlPlaygroundSim', () => {
  it('motor yüklenince başlangıç sorgusunun adımlarını gösterir', async () => {
    renderWithProviders(
      <SqlPlaygroundSim params={{ dataset: 'shop' }} onInteract={() => undefined} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('SQL motoru');
    await screen.findByText('Adım 1/8');
    for (const k of ['FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT']) {
      expect(screen.getByRole('button', { name: k })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki adım' }));
    expect(screen.getByText('Adım 2/8')).toBeInTheDocument();
    expect(await screen.findByText(/15 eşleşen çift/)).toBeInTheDocument();
  });

  it('DDL/DML sorgularını reddeder ve desteklenmeyen sorguda adım görünümü olmadığını söyler', async () => {
    const onInteract = vi.fn();
    renderWithProviders(<SqlPlaygroundSim params={{ dataset: 'shop' }} onInteract={onInteract} />);
    await screen.findByText('Adım 1/8');
    fireEvent.change(editor(), { target: { value: 'DROP TABLE customers' } });
    fireEvent.click(screen.getByRole('button', { name: /Çalıştır/ }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('DROP reddedildi');

    fireEvent.change(editor(), {
      target: { value: 'SELECT name FROM customers WHERE id IN (SELECT customer_id FROM orders)' },
    });
    fireEvent.keyDown(editor(), { key: 'Enter', ctrlKey: true });
    expect(screen.getByText(/adım görünümü yok/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sonuç' }));
    expect(screen.getByText('7 satır')).toBeInTheDocument();
  });

  it('görevi referans sorguyla karşılaştırır', async () => {
    renderWithProviders(
      <SqlPlaygroundSim params={{ dataset: 'school' }} onInteract={() => undefined} />,
    );
    await screen.findByText(/Adım 1\//);
    fireEvent.change(editor(), { target: { value: 'SELECT name FROM students' } });
    fireEvent.click(screen.getByRole('button', { name: /Kontrol et/ }));
    await waitFor(() =>
      expect(screen.getByText(/Satır sayısı tutmuyor: beklenen 3/)).toBeInTheDocument(),
    );
    fireEvent.change(editor(), { target: { value: 'SELECT name FROM students WHERE year = 1;' } });
    fireEvent.click(screen.getByRole('button', { name: /Kontrol et/ }));
    expect(screen.getByText(/Doğru!/)).toBeInTheDocument();
  });
});
