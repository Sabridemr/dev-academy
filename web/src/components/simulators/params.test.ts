import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INTERACTIVE_PARAMS, InteractiveTypeSchema } from '@devacademy/shared';

/**
 * Shared INTERACTIVE_PARAMS listesi içerik doğrulayıcısının kabul ettiği parametrelerdir.
 * Bu test listedeki her anahtarın ilgili web simülatörünün kaynağında gerçekten geçtiğini kontrol eder;
 * simülatörden bir parametre kaldırılıp liste güncellenmezse test kırılır.
 */
const dir = __dirname;
const registry = readFileSync(join(dir, 'registry.tsx'), 'utf8');
const files = Object.fromEntries(
  Array.from(registry.matchAll(/'?([a-z-]+)'?:\s*load\(\(\) => import\('\.\/(\w+)'\)\)/g), (m) => [
    m[1],
    m[2],
  ]),
);

describe('interaktif parametre listesi', () => {
  it('her interaktif türün bir web simülatörü var', () => {
    expect(Object.keys(files).sort()).toEqual([...InteractiveTypeSchema.options].sort());
  });

  for (const type of InteractiveTypeSchema.options) {
    it(`${type}: listelenen parametreler simülatörde okunuyor`, () => {
      const source = readFileSync(join(dir, `${files[type]}.tsx`), 'utf8');
      const missing = INTERACTIVE_PARAMS[type].filter(
        (key) => !source.includes(`'${key}'`) && !source.includes(`params.${key}`),
      );
      expect(missing).toEqual([]);
    });
  }
});
