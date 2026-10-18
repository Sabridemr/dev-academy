/// <reference types="expo/types" />

/**
 * Ortam değişkeni tipleri. EXPO_PUBLIC_* değişkenleri Metro tarafından derleme anında
 * koda gömülür (process.env.EXPO_PUBLIC_X sabit erişimi gerekir).
 */
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_WEB_URL?: string;
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
    EXPO_PUBLIC_EAS_PROJECT_ID?: string;
    EAS_PROJECT_ID?: string;
    APP_VARIANT?: string;
  }
}
