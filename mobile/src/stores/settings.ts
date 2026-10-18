import { create } from 'zustand';
import { getLocales } from 'expo-localization';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@devacademy/shared';
import { kv, KV_KEYS } from '@/lib/storage';

/**
 * Uygulama ayarları (dil, tema). MMKV'de kalıcıdır; ilk açılışta dil cihaz dilinden tahmin edilir.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

function initialLocale(): Locale {
  const stored = kv.getString(KV_KEYS.locale);
  if (stored && isLocale(stored)) return stored;
  try {
    const device = getLocales()[0]?.languageCode ?? '';
    if (isLocale(device)) return device;
  } catch {
    // expo-localization kullanılamıyorsa (ör. test ortamı) varsayılana düş
  }
  return DEFAULT_LOCALE;
}

function initialTheme(): ThemePreference {
  const stored = kv.getString(KV_KEYS.theme);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

interface SettingsState {
  locale: Locale;
  theme: ThemePreference;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  locale: initialLocale(),
  theme: initialTheme(),
  setLocale: (locale) => {
    kv.set(KV_KEYS.locale, locale);
    set({ locale });
  },
  setTheme: (theme) => {
    kv.set(KV_KEYS.theme, theme);
    set({ theme });
  },
}));
