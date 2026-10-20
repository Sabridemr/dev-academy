import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OAuthFlowSim from './OAuthFlowSim';
import { SAMPLE, attackExchange, buildSteps, interceptOutcome } from './oauthFlow.logic';

const keys = (flow: Parameters<typeof buildSteps>[0], pkce: boolean) =>
  buildSteps(flow, pkce, 'en').flatMap((s) => s.params.map(([k]) => k));

describe('oauthFlow.logic', () => {
  it('PKCE örnek çifti RFC 7636 ile tutarlı: challenge = BASE64URL(SHA256(verifier))', () => {
    expect(createHash('sha256').update(SAMPLE.codeVerifier).digest('base64url')).toBe(
      SAMPLE.codeChallenge,
    );
  });

  it('PKCE açıkken challenge ve verifier gönderilir, kapalıyken gönderilmez', () => {
    expect(keys('authorization-code', true)).toEqual(
      expect.arrayContaining([
        'code_challenge',
        'code_challenge_method',
        'code_verifier',
        'state',
        'code',
      ]),
    );
    expect(keys('authorization-code', false)).not.toContain('code_verifier');
    expect(keys('authorization-code', false)).not.toContain('code_challenge');
  });

  it('client credentials tarayıcısız ve kodsuzdur; implicit token’ı URL’de verir', () => {
    const cc = buildSteps('client-credentials', true, 'en');
    expect(cc.every((s) => s.from !== 'browser' && s.to !== 'browser')).toBe(true);
    expect(keys('client-credentials', true)).toContain('client_secret');
    const imp = buildSteps('implicit', true, 'en');
    expect(imp.find((s) => s.exposes)?.exposes).toBe('token');
    expect(keys('implicit', true)).not.toContain('code_challenge');
  });

  it('ele geçirilen kod: PKCE ile engellenir, PKCE olmadan çalınır', () => {
    expect(interceptOutcome('authorization-code', true)).toBe('blocked');
    expect(interceptOutcome('authorization-code', false)).toBe('stolen');
    expect(interceptOutcome('implicit', false)).toBe('token-leaked');
    expect(interceptOutcome('client-credentials', false)).toBe('not-applicable');
    expect(attackExchange('authorization-code', true).response).toMatch(/invalid_grant/);
  });
});

describe('OAuthFlowSim', () => {
  it('ileri/geri adımlar ve parametreler; saldırı senaryosu PKCE ile engellenir', () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <OAuthFlowSim params={{ flow: 'authorization-code', pkce: true }} onInteract={onInteract} />,
    );
    expect(screen.getByText(/Adım 1\/9/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    expect(onInteract).toHaveBeenCalled();
    expect(screen.getByText(/Adım 2\/9/)).toBeInTheDocument();
    expect(screen.getByText('code_challenge')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Geri' }));
    expect(screen.getByText(/Adım 1\/9/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Saldırı senaryosu/));
    expect(screen.getByTestId('oauth-outcome')).toHaveTextContent(/engellendi/);
    fireEvent.click(screen.getByLabelText(/PKCE/));
    expect(screen.getByTestId('oauth-outcome')).toHaveTextContent(/başarılı/);
  });

  it('implicit akışta önerilmez uyarısı gösterir', () => {
    renderWithProviders(
      <OAuthFlowSim params={{ flow: 'implicit' }} onInteract={() => undefined} />,
      'en',
    );
    expect(screen.getByText(/no longer recommended/)).toBeInTheDocument();
  });
});
