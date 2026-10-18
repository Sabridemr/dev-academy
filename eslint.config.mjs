// DevAcademy — tüm çalışma alanı için ESLint (flat config).
// Her paketin `lint` betiği kendi klasöründe `eslint .` çalıştırır; bu dosya üst dizinden bulunur.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'web/next-env.d.ts',
      'mobile/expo-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // CommonJS yapılandırma dosyaları (jest, babel, metro, detox)
  {
    files: ['**/*.cjs', '**/*.config.js', 'mobile/babel.config.js', 'mobile/metro.config.js', 'mobile/.detoxrc.js', 'mobile/stubs/**/*.js', 'mobile/e2e/jest.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // React (web + mobil)
  {
    files: ['web/**/*.{ts,tsx}', 'mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: reactHooks.configs.recommended.rules,
  },
  // Next.js kuralları
  {
    files: ['web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    // App Router kullanıldığı için pages/ yok; bu kural yalnızca pages yönlendirmesi içindir
    rules: { ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs['core-web-vitals'].rules, '@next/next/no-html-link-for-pages': 'off' },
  },
  // Testler
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.ts', '**/__tests__/**', '**/test/**', '**/e2e/**', 'mobile/jest.setup.ts'],
    languageOptions: { globals: { ...globals.jest, ...globals.vitest } },
    rules: { '@typescript-eslint/no-require-imports': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
  prettier,
);
