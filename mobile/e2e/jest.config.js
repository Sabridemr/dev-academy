/**
 * Detox için ayrı Jest yapılandırması (birim testlerden bağımsız).
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.e2e.ts'],
  testTimeout: 180000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  transform: {
    '\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  verbose: true,
};
