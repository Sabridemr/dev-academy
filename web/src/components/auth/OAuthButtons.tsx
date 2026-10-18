'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import type { AuthResponse } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
const APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;

interface GoogleIdApi {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
interface AppleIdApi {
  init: (cfg: Record<string, unknown>) => void;
  signIn: () => Promise<{
    authorization: { id_token: string };
    user?: { name?: { firstName?: string; lastName?: string } };
  }>;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
    AppleID?: { auth: AppleIdApi };
  }
}

/**
 * Google Identity Services ve Sign in with Apple JS. Sağlayıcıdan alınan ID token
 * backend'e (/auth/oauth) gönderilir; doğrulama sunucuda yapılır.
 * İstemci kimlikleri ortam değişkeni olarak verilmediyse butonlar devre dışı görünür.
 */
export function OAuthButtons({
  onSuccess,
  onError,
}: {
  onSuccess: (r: AuthResponse) => void;
  onError: (m: string) => void;
}) {
  const { t, locale } = useI18n();
  const googleRef = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [appleReady, setAppleReady] = useState(false);

  const exchange = async (provider: 'google' | 'apple', idToken: string, displayName?: string) => {
    try {
      onSuccess(
        await api<AuthResponse>('/auth/oauth', {
          method: 'POST',
          body: { provider, idToken, displayName },
          anonymous: true,
        }),
      );
    } catch (err) {
      onError(
        err instanceof ApiError ? (err.body.message ?? t('common.error')) : t('common.error'),
      );
    }
  };

  useEffect(() => {
    if (!googleReady || !GOOGLE_CLIENT_ID || !window.google || !googleRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (r) => void exchange('google', r.credential),
    });
    window.google.accounts.id.renderButton(googleRef.current, {
      theme: 'outline',
      size: 'large',
      width: 360,
      locale,
      text: 'continue_with',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady, locale]);

  useEffect(() => {
    if (!appleReady || !APPLE_CLIENT_ID || !window.AppleID) return;
    window.AppleID.auth.init({
      clientId: APPLE_CLIENT_ID,
      scope: 'name email',
      redirectURI: APPLE_REDIRECT_URI ?? window.location.origin,
      usePopup: true,
    });
  }, [appleReady]);

  const appleSignIn = async () => {
    if (!window.AppleID) return;
    try {
      const res = await window.AppleID.auth.signIn();
      const name =
        [res.user?.name?.firstName, res.user?.name?.lastName].filter(Boolean).join(' ') ||
        undefined;
      await exchange('apple', res.authorization.id_token, name);
    } catch {
      /* kullanıcı iptal etti */
    }
  };

  return (
    <div className="space-y-2">
      {GOOGLE_CLIENT_ID ? (
        <>
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onLoad={() => setGoogleReady(true)}
          />
          <div ref={googleRef} className="flex justify-center" />
        </>
      ) : (
        <button
          type="button"
          className="btn-ghost w-full"
          disabled
          title={t('auth.oauthUnavailable')}
        >
          {t('auth.google')}
        </button>
      )}
      {APPLE_CLIENT_ID ? (
        <>
          <Script
            src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
            strategy="afterInteractive"
            onLoad={() => setAppleReady(true)}
          />
          <button
            type="button"
            className="btn w-full bg-black text-white hover:bg-black/85"
            onClick={appleSignIn}
            disabled={!appleReady}
          >
            {t('auth.apple')}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn-ghost w-full"
          disabled
          title={t('auth.oauthUnavailable')}
        >
          {t('auth.apple')}
        </button>
      )}
    </div>
  );
}
