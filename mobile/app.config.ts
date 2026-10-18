import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo uygulama yapılandırması.
 * Ortam değişkenleri .env dosyasından (EXPO_PUBLIC_*) okunur; derleme profiline göre
 * EAS tarafında da tanımlanabilir (eas.json → env).
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

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
  newArchEnabled: true,
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
    edgeToEdgeEnabled: true,
    permissions: ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM'],
  },
  plugins: [
    'expo-router',
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
