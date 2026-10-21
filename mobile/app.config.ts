import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo uygulama yapılandırması.
 * Ortam değişkenleri .env dosyasından (EXPO_PUBLIC_*) okunur; derleme profiline göre
 * EAS tarafında da tanımlanabilir (eas.json → env).
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

// Mağaza derlemesinde API adresi https olmalı: eksikse uygulama sessizce http://localhost'a düşer ve
// Android release cleartext'i engellediği için çalışma anında anlaşılmaz biçimde bozulurdu.
const profile = process.env.EAS_BUILD_PROFILE;
if (
  profile &&
  profile !== 'development' &&
  !process.env.EXPO_PUBLIC_API_URL?.startsWith('https://')
) {
  throw new Error(`EAS "${profile}" derlemesi için EXPO_PUBLIC_API_URL https olmalı`);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'DevAcademy (Dev)' : 'DevAcademy',
  slug: 'devacademy',
  scheme: 'devacademy',
  version: '0.1.0',
  // Yalnızca mobil hedefler (web sürümü ayrı Next.js uygulamasıdır: web/)
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#F8FAFC',
  ios: {
    bundleIdentifier: IS_DEV ? 'com.devacademy.app.dev' : 'com.devacademy.app',
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: IS_DEV ? 'com.devacademy.app.dev' : 'com.devacademy.app',
    // Günlük (DAILY) tetikleyici tam zamanlı alarm gerektirmez; Android 14+'ta SCHEDULE_EXACT_ALARM varsayılan reddedilir
    permissions: ['POST_NOTIFICATIONS'],
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-font',
    'expo-secure-store',
    'expo-sqlite',
    'expo-localization',
    'expo-apple-authentication',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        color: '#6366F1',
        defaultChannel: 'daily-reminder',
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    router: {},
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? undefined,
    },
  },
});
