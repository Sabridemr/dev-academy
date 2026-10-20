import Constants from 'expo-constants';

/**
 * Çalışma zamanı yapılandırması. EXPO_PUBLIC_* değişkenleri Metro tarafından derleme anında
 * gömülür; bu yüzden process.env.EXPO_PUBLIC_X biçiminde DOĞRUDAN erişilmelidir.
 */
function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

const LOCAL_HOSTS = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/;

/**
 * Geliştirme derlemesinde JS paketini veren Metro sunucusunun adresi ("10.0.0.5:8081").
 * Telefonda "localhost" telefonun kendisidir; API/web varsayılanları o yüzden Metro'nun
 * çalıştığı makineye (sunucuya) çevrilir. .env'de gerçek bir adres verildiyse ona dokunulmaz.
 */
function metroHost(): string | null {
  if (!__DEV__) return null;
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? null;
  const host = hostUri?.split(':')[0];
  return host && !/^(localhost|127\.0\.0\.1)$/.test(host) ? host : null;
}

function devUrl(value: string | undefined, fallback: string, port: number, path = ''): string {
  const url = trimSlash(value ?? fallback);
  const host = metroHost();
  return host && LOCAL_HOSTS.test(url) ? `http://${host}:${port}${path}` : url;
}

export const env = {
  apiUrl: devUrl(process.env.EXPO_PUBLIC_API_URL, 'http://localhost:4000/api/v1', 4000, '/api/v1'),
  webUrl: devUrl(process.env.EXPO_PUBLIC_WEB_URL, 'http://localhost:3000', 3000),
  google: {
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  },
} as const;

/** EAS proje kimliği (Expo push token için gerekli) */
export function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}
