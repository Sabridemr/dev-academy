import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import JwtInspectorSim from './JwtInspectorSim';
import {
  base64urlDecode,
  base64urlDecodeString,
  base64urlEncode,
  base64urlEncodeString,
  checkAlg,
  constantTimeEqual,
  expStatus,
  forgeNoneToken,
  hasWebCrypto,
  parseJwt,
  signJwt,
  verifyJwt,
} from './jwtInspector.logic';

/** jwt.io'daki klasik örnek (secret: "your-256-bit-secret") */
const JWT_IO =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const crypto = hasWebCrypto() ? it : it.skip;

describe('jwtInspector.logic', () => {
  it('base64url gidiş-dönüş: dolgusuz, URL güvenli, UTF-8', () => {
    const bytes = new Uint8Array([251, 255, 191, 0, 1]);
    const enc = base64urlEncode(bytes);
    expect(enc).not.toMatch(/[+/=]/);
    expect(Array.from(base64urlDecode(enc))).toEqual(Array.from(bytes));
    expect(base64urlEncodeString('hi')).toBe('aGk');
    expect(base64urlDecodeString(base64urlEncodeString('Çağrı ✓'))).toBe('Çağrı ✓');
    expect(() => base64urlDecode('a$b')).toThrow();
  });

  it('parseJwt üç parçayı ayırır, hatalı biçimi bildirir', () => {
    const p = parseJwt(JWT_IO);
    expect(p.ok).toBe(true);
    expect(p.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(p.payload?.name).toBe('John Doe');
    expect(parseJwt('abc.def').ok).toBe(false);
  });

  it('exp durumu ve alg kontrolü', () => {
    expect(expStatus({ exp: 100 }, 50)).toBe('valid');
    expect(expStatus({ exp: 100 }, 100)).toBe('expired');
    expect(expStatus({ nbf: 200, exp: 300 }, 100)).toBe('not-yet-valid');
    expect(expStatus({}, 1)).toBe('none');
    expect(checkAlg({ alg: 'none' })).toBe('none');
    expect(checkAlg({ alg: 'RS256' })).toBe('unsupported');
    expect(checkAlg({ alg: 'HS256' })).toBe('ok');
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
  });

  crypto(
    'HS256: bilinen vektörü doğrular, değiştirilmiş gövdeyi ve alg:none’u reddeder',
    async () => {
      expect(await verifyJwt(JWT_IO, 'your-256-bit-secret')).toEqual({ status: 'valid' });
      expect((await verifyJwt(JWT_IO, 'wrong')).status).toBe('invalid-signature');
      const [h, , s] = JWT_IO.split('.');
      const tampered = `${h}.${base64urlEncodeString('{"sub":"1","role":"admin"}')}.${s}`;
      expect((await verifyJwt(tampered, 'your-256-bit-secret')).status).toBe('invalid-signature');
      const forged = forgeNoneToken(JWT_IO);
      expect(parseJwt(forged).payload?.role).toBe('admin');
      expect((await verifyJwt(forged, 'your-256-bit-secret')).status).toBe('rejected-none');
      const signed = await signJwt({ alg: 'HS256', typ: 'JWT' }, { sub: 'x' }, 'k');
      expect(await verifyJwt(signed, 'k')).toEqual({ status: 'valid' });
    },
  );
});

describe('JwtInspectorSim', () => {
  crypto('verilen token’ı doğrular; gövde değişince imza geçersiz olur', async () => {
    const onInteract = vi.fn();
    renderWithProviders(
      <JwtInspectorSim
        params={{ token: JWT_IO, secret: 'your-256-bit-secret' }}
        onInteract={onInteract}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('jwt-verify')).toHaveTextContent(/İmza geçerli/));
    expect(screen.getByTestId('jwt-exp')).toHaveTextContent(/exp alanı yok/);
    const payload = screen.getByLabelText(/Gövde/);
    fireEvent.change(payload, { target: { value: '{"sub":"1234567890","name":"Mallory"}' } });
    expect(onInteract).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId('jwt-verify')).toHaveTextContent(/İmza geçersiz/),
    );
    expect(screen.getByTestId('jwt-decision')).toHaveTextContent('RED');
    fireEvent.click(screen.getByRole('button', { name: /Yeniden imzala/ }));
    await waitFor(() => expect(screen.getByTestId('jwt-verify')).toHaveTextContent(/İmza geçerli/));
  });

  crypto('token yoksa geçerli bir örnek üretir; alg:none hilesi reddedilir', async () => {
    renderWithProviders(<JwtInspectorSim params={{}} onInteract={() => undefined} />, 'en');
    await waitFor(() =>
      expect(screen.getByTestId('jwt-verify')).toHaveTextContent(/Signature valid/),
    );
    expect(screen.getByTestId('jwt-decision')).toHaveTextContent('ACCEPT');
    expect(screen.getByTestId('jwt-exp')).toHaveTextContent(/Not expired/);
    fireEvent.click(screen.getByRole('button', { name: /alg: none/ }));
    await waitFor(() => expect(screen.getByTestId('jwt-verify')).toHaveTextContent(/Rejected/));
    expect(screen.getByTestId('jwt-decision')).toHaveTextContent('REJECT');
  });
});
