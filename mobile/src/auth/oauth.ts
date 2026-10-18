import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import type { AuthResponse } from '@devacademy/shared';
import { env } from '@/config/env';
import { endpoints } from '@/lib/endpoints';

/**
 * SOSYAL GİRİŞ
 * - Google: expo-auth-session ile ID token alınır → POST /auth/oauth { provider: 'google', idToken }
 * - Apple (yalnızca iOS): expo-apple-authentication → identityToken → POST /auth/oauth
 * Backend ID token'ı sağlayıcının açık anahtarlarıyla doğrular (GOOGLE_CLIENT_IDS / APPLE_CLIENT_IDS).
 */
WebBrowser.maybeCompleteAuthSession();

export function isGoogleConfigured(): boolean {
  if (Platform.OS === 'ios') return Boolean(env.google.iosClientId);
  if (Platform.OS === 'android') return Boolean(env.google.androidClientId);
  return Boolean(env.google.webClientId);
}

/**
 * Google ile giriş kancası. `signIn()` tarayıcı akışını başlatır; başarıda onSuccess AuthResponse ile çağrılır.
 * İstemci kimlikleri yapılandırılmamışsa `available=false` döner (buton devre dışı gösterilir).
 */
export function useGoogleSignIn(onSuccess: (res: AuthResponse) => void, onError: (e: unknown) => void) {
  const available = isGoogleConfigured();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    // Boş string verilirse kanca hata fırlatır; yapılandırılmamışsa yer tutucu kullanılır ve buton gizlenir
    iosClientId: env.google.iosClientId || 'unconfigured',
    androidClientId: env.google.androidClientId || 'unconfigured',
    webClientId: env.google.webClientId || 'unconfigured',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response) setBusy(false);
      return;
    }
    const idToken = response.params.id_token ?? response.authentication?.idToken;
    if (!idToken) {
      setBusy(false);
      onError(new Error('Google id_token missing'));
      return;
    }
    endpoints
      .oauth({ provider: 'google', idToken })
      .then(onSuccess)
      .catch(onError)
      .finally(() => setBusy(false));
    // onSuccess/onError ekran tarafından her render'da yeniden oluşturulabilir; yalnızca yanıt değişimini izle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return {
    available: available && Boolean(request),
    busy,
    signIn: async () => {
      setBusy(true);
      try {
        await promptAsync();
      } catch (e) {
        setBusy(false);
        onError(e);
      }
    },
  };
}

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Apple ile giriş; kullanıcı iptal ederse null döner */
export async function signInWithApple(): Promise<AuthResponse | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error('Apple identityToken missing');
    // Apple adı yalnızca ilk girişte paylaşır
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').trim();
    return await endpoints.oauth({ provider: 'apple', idToken: credential.identityToken, displayName: name || undefined });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}
