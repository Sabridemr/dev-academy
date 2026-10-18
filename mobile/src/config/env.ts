import Constants from 'expo-constants';

/**
 * Çalışma zamanı yapılandırması. EXPO_PUBLIC_* değişkenleri Metro tarafından derleme anında
 * gömülür; bu yüzden process.env.EXPO_PUBLIC_X biçiminde DOĞRUDAN erişilmelidir.
 */
function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const env = {
  apiUrl: trimSlash(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'),
  webUrl: trimSlash(process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
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
