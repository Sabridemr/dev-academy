import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/stores/settings';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export * from './tokens';

/**
 * Tema sağlayıcısı: sistem temasını izler; kullanıcı Profil'den açık/koyu seçerek geçersiz kılabilir.
 */
export interface Theme {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: lightColors });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const scheme: 'light' | 'dark' =
    pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const value = useMemo<Theme>(
    () => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
