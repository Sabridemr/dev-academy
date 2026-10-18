import { defineConfig } from 'tsup';

// Hem CJS (NestJS / Jest) hem ESM (Next.js / Metro) tüketicileri için çift format üretiyoruz.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'scene/index': 'src/scene/index.ts',
    'content/index': 'src/content/index.ts',
    'simulators/index': 'src/simulators/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
