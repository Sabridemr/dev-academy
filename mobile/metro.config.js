/**
 * Metro yapılandırması (pnpm + Turborepo monorepo).
 *
 * - watchFolders: depo kökü izlenir; böylece packages/shared değişiklikleri anında görülür.
 * - nodeModulesPaths: önce mobile/node_modules, sonra kök node_modules aranır
 *   (.npmrc → node-linker=hoisted olduğu için paketler çoğunlukla kökte durur).
 * - Tekil paketler (react, react-native ...) her zaman mobil projenin çözdüğü kopyaya
 *   yönlendirilir: web farklı bir React sürümü kullandığında Metro'nun iki kopya
 *   paketlemesini engeller.
 * - gray-matter: @devacademy/shared içindeki Markdown ayrıştırıcısı (yalnızca Node'da
 *   kullanılır) `fs` gerektirir; mobilde boş bir saplama (stub) ile değiştirilir.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const SINGLETONS = ['react', 'react-native', 'react-native-reanimated', 'react-native-svg', 'expo', 'expo-router'];

/** Paket kök dizinini mobil projeden başlayarak bulur */
function singletonRoot(name) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`, { paths: [projectRoot] }));
  } catch {
    return null;
  }
}
const singletonRoots = Object.fromEntries(SINGLETONS.map((n) => [n, singletonRoot(n)]).filter(([, p]) => p));

const STUBS = {
  'gray-matter': path.resolve(projectRoot, 'stubs/gray-matter.js'),
};

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: STUBS[moduleName] };
  }
  for (const name of SINGLETONS) {
    const root = singletonRoots[name];
    if (!root) continue;
    if (moduleName === name || moduleName.startsWith(`${name}/`)) {
      // Çözümlemeyi mobil projenin bakış açısından yap
      const resolve = defaultResolve ?? context.resolveRequest;
      return resolve(
        { ...context, originModulePath: path.join(projectRoot, 'package.json') },
        moduleName,
        platform,
      );
    }
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
