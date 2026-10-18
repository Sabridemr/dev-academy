/**
 * Jest ortamı: native modüller için bellek içi sahteler (mock).
 * react-native-mmkv v3 test ortamında kendi bellek içi uygulamasını otomatik kullanır.
 */

// SecureStore — bellek içi anahtar-değer
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    __store: store,
  };
});

// Reanimated — resmi mock (animasyonlar anında uygulanır)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// NetInfo — resmi mock
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

// expo-localization — sabit cihaz dili
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'tr', languageTag: 'tr-TR' }],
}));

// expo-sqlite — testler kendi sahte veritabanını enjekte eder; doğrudan açılış bellek içi sahte döner
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 1, lastInsertRowId: 1 })),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  })),
}));

// Lottie / Rive — native görünümler testte basit View olarak
jest.mock('lottie-react-native', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});
jest.mock('rive-react-native', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Fit: { Contain: 'contain' } };
});
