/**
 * Zod şemalarını JSON Schema'ya aktarır; editörlerde (VS Code) sahne/quiz JSON'ları için otomatik tamamlama sağlar.
 * Çalıştır: pnpm --filter @devacademy/shared schema:export
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AnimationSceneSchema } from '../src/scene/schema';
import {
  LessonFrontmatterSchema,
  ModuleManifestSchema,
  QuizSchema,
  LearningPathManifestSchema,
} from '../src/content/schema';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'schema');
mkdirSync(outDir, { recursive: true });

const targets: [string, Parameters<typeof zodToJsonSchema>[0]][] = [
  ['animation-scene.schema.json', AnimationSceneSchema],
  ['quiz.schema.json', QuizSchema],
  ['lesson-frontmatter.schema.json', LessonFrontmatterSchema],
  ['module.schema.json', ModuleManifestSchema],
  ['learning-path.schema.json', LearningPathManifestSchema],
];

for (const [file, schema] of targets) {
  const json = zodToJsonSchema(schema, {
    name: file.replace('.schema.json', ''),
    $refStrategy: 'none',
  });
  writeFileSync(join(outDir, file), JSON.stringify(json, null, 2) + '\n');
  console.log(`✓ ${file}`);
}
