/**
 * Babel yapılandırması. Reanimated 4 / worklets eklentisi HER ZAMAN listenin sonunda olmalıdır.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
