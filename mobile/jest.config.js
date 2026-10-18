/**
 * Jest yapılandırması (jest-expo ön ayarı).
 * - @/ yol takma adı → src/
 * - gray-matter → saplama (shared paketindeki Node'a özel Markdown ayrıştırıcısı)
 * - React Native / Expo paketleri Babel ile dönüştürülür (transformIgnorePatterns istisnaları)
 */
const path = require('path');

/** Testlerde mobil projenin çözdüğü tek React kopyasını kullan (web farklı sürüm kullanabilir) */
const reactDir = path.dirname(require.resolve('react/package.json', { paths: [__dirname] }));

module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^gray-matter$': '<rootDir>/stubs/gray-matter.js',
    '^react$': reactDir,
    '^react/(.*)$': `${reactDir}/$1`,
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-markdown-display|react-native-mmkv|rive-react-native|lottie-react-native|@tanstack/.*|zustand|@devacademy/.*))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  clearMocks: true,
};
