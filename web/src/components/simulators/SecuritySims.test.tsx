import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import RbacAbacSim from './RbacAbacSim';
import ThreatModelSim from './ThreatModelSim';
import HashSaltSim from './HashSaltSim';
import RegexPlaygroundSim from './RegexPlaygroundSim';
import { hasWebCrypto } from './hashSalt.logic';
import { PRESETS } from './regexPlayground.logic';

const crypto = hasWebCrypto() ? it : it.skip;

describe('RbacAbacSim', () => {
  it('RBAC: üçlü seçimi kararı değiştirir; yükseltme senaryosu fazladan izinleri listeler', () => {
    const onInteract = vi.fn();
    renderWithProviders(<RbacAbacSim params={{ mode: 'rbac' }} onInteract={onInteract} />);
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('İZİN');
    fireEvent.click(screen.getByRole('button', { name: /Zeynep/ }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('RET');
    expect(screen.getByTestId('rbac-extra')).toHaveTextContent(/fazladan izin yok/);

    fireEvent.click(screen.getByRole('button', { name: /Ayrıcalık yükseltme/ }));
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('İZİN');
    expect(screen.getByTestId('rbac-extra')).toHaveTextContent(/fazladan verilen izin: 8/);
    expect(screen.getByTestId('rbac-extra')).toHaveTextContent('can → delete → inv-1043');
    expect(screen.getByTestId('rbac-current-extra')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Temel politikaya dön/ }));
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('RET');
    // Matris hücresini elle açmak
    fireEvent.click(screen.getByRole('button', { name: 'viewer × delete' }));
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('İZİN');
  });

  it('ABAC: ret önceliği, kural sırası ve kural ekleme', () => {
    renderWithProviders(<RbacAbacSim params={{ mode: 'abac' }} onInteract={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /^Can/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fatura #1043/ }));
    fireEvent.click(screen.getByRole('button', { name: /okuma/ }));
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('RET');
    expect(screen.getByTestId('rbac-steps')).toHaveTextContent(/#5 açık ret/);

    fireEvent.change(screen.getByDisplayValue(/Ret öncelikli/), {
      target: { value: 'first-applicable' },
    });
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('İZİN');
    // #5'i (gizli veri reddi) en üste taşı: ilk eşleşen yine ret olur
    for (const n of [5, 4, 3, 2])
      fireEvent.click(screen.getByRole('button', { name: `Yukarı taşı #${n}` }));
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('RET');
  });

  it('ABAC: senaryo parametresiyle yükseltilmiş kural ve örnek üçlü yüklenir', () => {
    renderWithProviders(
      <RbacAbacSim
        params={{ mode: 'abac', scenario: 'escalation' }}
        onInteract={() => undefined}
      />,
      'en',
    );
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('ALLOW');
    expect(screen.getByTestId('rbac-current-extra')).toBeInTheDocument();
    const input = screen.getByLabelText('New rule condition');
    fireEvent.change(input, { target: { value: 'user.level <' } });
    expect(screen.getByRole('button', { name: /Add rule/ })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'user.department != resource.department' } });
    fireEvent.change(screen.getByLabelText('Effect'), { target: { value: 'deny' } });
    fireEvent.click(screen.getByRole('button', { name: /Add rule/ }));
    expect(within(screen.getByTestId('abac-rules')).getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByTestId('rbac-decision')).toHaveTextContent('DENY');
  });
});

describe('ThreatModelSim', () => {
  it('öğe seçilir, işaretlenir; göster düğmesi puanı ve önlemleri açar', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <ThreatModelSim params={{ scenario: 'web-app' }} onInteract={onInteract} />,
    );
    const browser = screen.getByTestId('tm-browser');
    fireEvent.keyDown(browser, { key: 'Enter' });
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByTestId('tm-panel')).toHaveTextContent('Tarayıcı');
    fireEvent.click(screen.getByRole('checkbox', { name: /Kimlik sahteciliği/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Hizmet engelleme/ }));
    expect(screen.getByLabelText('Kısa gerekçen (S)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Bitirdim, göster/ }));
    expect(screen.getByTestId('threat-score')).toHaveTextContent(/^1\/\d+$/);
    const panel = screen.getByTestId('tm-panel');
    expect(panel).toHaveTextContent('buldun');
    expect(panel).toHaveTextContent('kaçırdın');
    expect(panel).toHaveTextContent('beklenmiyor');
    expect(panel).toHaveTextContent(/Önlem:/);

    fireEvent.click(screen.getByTestId('tm-f-sql'));
    expect(screen.getByTestId('tm-panel')).toHaveTextContent(/Parametreli sorgular/);
  });

  it('senaryo değişince işaretler sıfırlanır', () => {
    renderWithProviders(
      <ThreatModelSim params={{ scenario: 'ci-pipeline' }} onInteract={() => undefined} />,
      'en',
    );
    expect(screen.getByTestId('tm-runner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Spoofing/ }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mobile-payment' } });
    expect(screen.getByTestId('tm-f-webhook')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Spoofing/ })).not.toBeChecked();
  });
});

describe('HashSaltSim', () => {
  crypto('tuzsuz hash’ler aynı, tuzlu hash’ler farklı; saldırgan paneli açılır', async () => {
    renderWithProviders(
      <HashSaltSim
        params={{ algorithm: 'sha256', showAttack: true }}
        onInteract={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('hs-same')).toBeInTheDocument());
    expect(screen.getByTestId('hs-unsalted-a').textContent).toBe(
      screen.getByTestId('hs-unsalted-b').textContent,
    );
    expect(screen.getByTestId('hs-salted-a').textContent).not.toBe(
      screen.getByTestId('hs-salted-b').textContent,
    );
    expect(screen.getByTestId('hs-differ')).toBeInTheDocument();
    expect(screen.getByTestId('hs-dict')).toHaveTextContent(/sözlükte var/);
    expect(screen.getByTestId('hs-attack-rainbow')).toHaveTextContent('anında');
    fireEvent.change(screen.getByDisplayValue('galatasaray1'), {
      target: { value: 'k8#Qz!v2-mL0' },
    });
    expect(screen.getByTestId('hs-dict')).toHaveTextContent(/sözlükte yok/);
  });

  it('saldırgan paneli parametreyle kapalı başlar ve düğmeyle açılır', () => {
    renderWithProviders(
      <HashSaltSim params={{ algorithm: 'pbkdf2' }} onInteract={() => undefined} />,
      'en',
    );
    expect(screen.queryByTestId('hs-attack')).toBeNull();
    expect(screen.getByText(/PBKDF2 iterations/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show attacker panel/ }));
    expect(screen.getByTestId('hs-attack')).toBeInTheDocument();
    expect(screen.getByTestId('hs-attack-pbkdf2')).toBeInTheDocument();
  });
});

describe('RegexPlaygroundSim', () => {
  it('log preset’i üç eşleşme gösterir; m bayrağı kapanınca eşleşme kalmaz', () => {
    const onInteract = vi.fn();
    renderWithProviders(<RegexPlaygroundSim params={{ preset: 'log' }} onInteract={onInteract} />);
    expect(screen.getByTestId('rx-count')).toHaveTextContent('3 eşleşme');
    expect(screen.getByTestId('rx-matches')).toHaveTextContent('seviye: "ERROR"');
    expect(screen.getByTestId('rx-explain')).toHaveTextContent('“tarih” adlı yakalama grubu');
    expect(screen.getByTestId('rx-python')).toHaveTextContent('(?P<ad>…)');
    fireEvent.click(screen.getByRole('button', { name: 'm' }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByTestId('rx-count')).toHaveTextContent('0 eşleşme');
  });

  it('ReDoS deseninde uyarır ve metni kısaltarak çalıştırır; geçersiz desende hata gösterir', () => {
    renderWithProviders(
      <RegexPlaygroundSim params={{ preset: 'email' }} onInteract={() => undefined} />,
      'en',
    );
    expect(screen.queryByTestId('rx-redos')).toBeNull();
    const pattern = screen.getByDisplayValue(PRESETS.email.pattern);
    fireEvent.change(pattern, { target: { value: '(\\w+\\s?)+$' } });
    expect(screen.getByTestId('rx-redos')).toHaveTextContent(/nested quantifier/);
    expect(screen.getByTestId('rx-highlight').textContent?.length).toBeLessThanOrEqual(12);
    fireEvent.change(pattern, { target: { value: '(abc' } });
    expect(screen.getByTestId('rx-error')).toBeInTheDocument();
    expect(screen.getByTestId('rx-explain-error')).toBeInTheDocument();
  });
});
