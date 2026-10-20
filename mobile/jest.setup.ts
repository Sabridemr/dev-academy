/**
 * Jest ortamı: native modüller için bellek içi sahteler (mock).
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
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// expo-localization — sabit cihaz dili
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'tr', languageTag: 'tr-TR' }],
}));

// expo-sqlite/kv-store — bellek içi senkron anahtar-değer deposu (storage.ts `kv`)
jest.mock('expo-sqlite/kv-store', () => {
  class SQLiteStorage {
    private map = new Map<string, string>();
    getItemSync(key: string): string | null {
      return this.map.get(key) ?? null;
    }
    setItemSync(key: string, value: string | ((prev: string | null) => string)): void {
      this.map.set(key, typeof value === 'function' ? value(this.getItemSync(key)) : value);
    }
    removeItemSync(key: string): boolean {
      return this.map.delete(key);
    }
    clearSync(): boolean {
      this.map.clear();
      return true;
    }
    getAllKeysSync(): string[] {
      return [...this.map.keys()];
    }
  }
  return { SQLiteStorage, Storage: new SQLiteStorage(), default: new SQLiteStorage() };
});

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

// Lottie — native görünüm testte basit View olarak
jest.mock('lottie-react-native', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

// expo-notifications — modül yüklenirken Expo Go push uyarısı basar; testler bildirim API'sini kullanmaz
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  setNotificationChannelAsync: jest.fn(async () => null),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

// @expo/vector-icons — v15 font'u asenkron yükleyip act() dışı güncelleme yapar; testlerde ikon görseli önemsiz
jest.mock('@expo/vector-icons', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => createElement(Text, null, name);
  return new Proxy({}, { get: () => Icon });
});
