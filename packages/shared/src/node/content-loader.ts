/**
 * content/ KLASÖRÜ YÜKLEYİCİSİ
 * ----------------------------
 * Dosya sistemini okuyup doğrulanmış içerik ağacını döner. Hem doğrulama scripti
 * hem de backend seed scripti bu modülü kullanır (Node ortamı).
 *
 * Beklenen yapı:
 *   content/
 *     paths.json                        → LearningPathManifest[]
 *     concepts.json                     → Glossary (kavram sözlüğü)
 *     modules/<module-id>/module.json   → ModuleManifest
 *     modules/<module-id>/<lesson-id>/lesson.md
 *     modules/<module-id>/<lesson-id>/lesson.en.md   (opsiyonel)
 *     modules/<module-id>/<lesson-id>/*.scene.json | scene.json
 *     modules/<module-id>/<lesson-id>/quiz.json
 *     modules/<module-id>/<lesson-id>/*.svg
 *     modules/<module-id>/<lesson-id>/*.trace.py → *.trace.json   (pnpm content:traces)
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  INTERACTIVE_PARAMS,
  TRACE_INTERACTIVES,
  interactiveTraceSrc,
  LessonBlockSchema,
  LearningPathManifestSchema,
  RESOURCES_SOFT_MAX,
  QUIZ_QUESTION_RANGE,
  ModuleManifestSchema,
  QuizSchema,
  type LearningPathManifest,
  type LessonDocument,
  type ModuleManifest,
  type Quiz,
} from '../content/schema';
import { parseLessonMarkdown, LessonParseError } from '../content/parser';
import { CodeTraceSchema, type CodeTrace } from '../content/trace';
import { isLessonBodyTranslated } from '../content/translation';
import { rasterExtension } from '../content/assets';
import { readImageSize } from './image-size';
import { validateScene } from '../scene/validate';
import type { AnimationScene } from '../scene/schema';
import { CURRICULUM } from '../content/curriculum';
import { GlossarySchema, buildConceptIndex, type Glossary } from '../content/glossary';

export interface LoadedScene {
  /** Ders klasörüne göre dosya adı (ör. "scene.json") */
  file: string;
  scene: AnimationScene;
}

export interface LoadedLesson {
  dir: string;
  doc: LessonDocument;
  scenes: LoadedScene[];
  quiz: Quiz | null;
  quizFile: string | null;
  /** svg dosya adı → içerik */
  svgs: Record<string, string>;
  /** raster görsel dosya adı → yol ve piksel boyutu (seed veritabanına alır) */
  images: Record<string, LoadedImage>;
  /** iz dosya adı (`x.trace.json`) → doğrulanmış kod izi */
  traces: Record<string, CodeTrace>;
}

export interface LoadedImage {
  path: string;
  width: number;
  height: number;
  bytes: number;
}

/** Tek bir ders görselinin üst sınırı (API'den tek parça sunulur, veritabanında tutulur) */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Bu boyutun üstündeki görseller için uyarı (sayfa ağırlığı) */
const WARN_IMAGE_BYTES = 500 * 1024;
/** Ders başına önerilen en az düzyazı kelime sayısı */
const MIN_PROSE_WORDS = 400;

export interface LoadedModule {
  dir: string;
  manifest: ModuleManifest;
  lessons: LoadedLesson[];
}

export interface ContentIssue {
  severity: 'error' | 'warning';
  file: string;
  message: string;
}

export interface LoadedContent {
  root: string;
  paths: LearningPathManifest[];
  modules: LoadedModule[];
  /** content/concepts.json; dosya yoksa ya da geçersizse null */
  glossary: Glossary | null;
  issues: ContentIssue[];
}

export const GLOSSARY_FILE = 'concepts.json';

/** content/concepts.json'u okuyup doğrular (seed ve doğrulayıcı kullanır) */
export function loadGlossary(root = findContentRoot()): {
  glossary: Glossary | null;
  issues: ContentIssue[];
} {
  const file = join(root, GLOSSARY_FILE);
  if (!existsSync(file)) {
    return {
      glossary: null,
      issues: [
        {
          severity: 'warning',
          file: GLOSSARY_FILE,
          message: 'Kavram sözlüğü yok; kavramlar doğrulanmadı',
        },
      ],
    };
  }
  let raw: unknown;
  try {
    raw = readJson(file);
  } catch (err) {
    return {
      glossary: null,
      issues: [
        { severity: 'error', file: GLOSSARY_FILE, message: `JSON parse hatası: ${String(err)}` },
      ],
    };
  }
  const parsed = GlossarySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      glossary: null,
      issues: [
        {
          severity: 'error',
          file: GLOSSARY_FILE,
          message: parsed.error.issues
            .slice(0, 10)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        },
      ],
    };
  }
  const glossary = parsed.data;
  const issues: ContentIssue[] = [];
  for (const [id, entry] of Object.entries(glossary)) {
    for (const r of entry.related) {
      if (r === id || !glossary[r]) {
        issues.push({
          severity: 'error',
          file: GLOSSARY_FILE,
          message: `'${id}'.related ${r === id ? 'kendisine' : `bilinmeyen kavrama`} işaret ediyor: ${r}`,
        });
      }
    }
  }
  return { glossary, issues };
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function findContentRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'content');
    if (existsSync(join(candidate, 'modules'))) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`content/ klasörü bulunamadı (başlangıç: ${start})`);
}

export function loadContent(root = findContentRoot()): LoadedContent {
  const issues: ContentIssue[] = [];
  const rel = (p: string) => relative(root, p).replace(/\\/g, '/');

  // Öğrenme yolları
  let paths: LearningPathManifest[] = [];
  const pathsFile = join(root, 'paths.json');
  if (existsSync(pathsFile)) {
    const parsed = LearningPathManifestSchema.array().safeParse(readJson(pathsFile));
    if (parsed.success) paths = parsed.data;
    else
      issues.push({
        severity: 'error',
        file: rel(pathsFile),
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
  } else {
    issues.push({
      severity: 'warning',
      file: 'paths.json',
      message: 'paths.json yok; müfredattaki varsayılan yollar kullanılacak',
    });
  }

  const modulesDir = join(root, 'modules');
  const modules: LoadedModule[] = [];
  const moduleDirs = existsSync(modulesDir)
    ? readdirSync(modulesDir)
        .filter((d) => statSync(join(modulesDir, d)).isDirectory())
        .sort()
    : [];

  for (const mDir of moduleDirs) {
    const moduleDir = join(modulesDir, mDir);
    const manifestFile = join(moduleDir, 'module.json');
    if (!existsSync(manifestFile)) {
      issues.push({ severity: 'error', file: rel(moduleDir), message: 'module.json eksik' });
      continue;
    }
    const manifestParsed = ModuleManifestSchema.safeParse(readJson(manifestFile));
    if (!manifestParsed.success) {
      issues.push({
        severity: 'error',
        file: rel(manifestFile),
        message: manifestParsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      });
      continue;
    }
    const manifest = manifestParsed.data;
    if (manifest.id !== mDir) {
      issues.push({
        severity: 'warning',
        file: rel(manifestFile),
        message: `Klasör adı (${mDir}) ile module.id (${manifest.id}) farklı`,
      });
    }

    const lessons: LoadedLesson[] = [];
    const lessonDirs = readdirSync(moduleDir)
      .filter((d) => statSync(join(moduleDir, d)).isDirectory())
      .sort();

    for (const lDir of lessonDirs) {
      const lessonDir = join(moduleDir, lDir);
      const mdFile = join(lessonDir, 'lesson.md');
      if (!existsSync(mdFile)) {
        issues.push({ severity: 'error', file: rel(lessonDir), message: 'lesson.md eksik' });
        continue;
      }
      let doc: LessonDocument;
      const mdSource = readFileSync(mdFile, 'utf8');
      // `:::ad{...}` görünümlü ama ayrıştırıcının tanımadığı satırlar (ör. öznitelikte `}`): directive
      // sessizce düz metne dönüşür; burada hata olarak raporlanır
      for (const [i, line] of mdSource.split('\n').entries()) {
        if (!/^:::[a-z][a-z0-9-]*\{/.test(line)) continue;
        if (/^:::[a-z][a-z0-9-]*\{[^}]*\}\s*$/.test(line)) continue;
        issues.push({
          severity: 'error',
          file: rel(mdFile),
          message: `satır ${i + 1}: directive açılış satırı ayrıştırılamadı (öznitelik değerinde "}" olamaz): ${line.slice(0, 60)}`,
        });
      }
      try {
        const enFile = join(lessonDir, 'lesson.en.md');
        doc = parseLessonMarkdown(mdSource, {
          sourcePath: rel(mdFile),
          englishMarkdown: existsSync(enFile) ? readFileSync(enFile, 'utf8') : undefined,
        });
      } catch (err) {
        issues.push({
          severity: 'error',
          file: rel(mdFile),
          message: err instanceof LessonParseError ? err.message : String(err),
        });
        continue;
      }
      if (doc.meta.id !== lDir) {
        issues.push({
          severity: 'warning',
          file: rel(mdFile),
          message: `Klasör adı (${lDir}) ile lesson id (${doc.meta.id}) farklı`,
        });
      }
      if (doc.meta.module !== manifest.id) {
        issues.push({
          severity: 'error',
          file: rel(mdFile),
          message: `lesson.module (${doc.meta.module}) modül id'si ile (${manifest.id}) eşleşmiyor`,
        });
      }

      // Sahneler
      const scenes: LoadedScene[] = [];
      const sceneFiles = readdirSync(lessonDir).filter(
        (f) => f === 'scene.json' || f.endsWith('.scene.json'),
      );
      for (const sf of sceneFiles) {
        const file = join(lessonDir, sf);
        let raw: unknown;
        try {
          raw = readJson(file);
        } catch (err) {
          issues.push({
            severity: 'error',
            file: rel(file),
            message: `JSON parse hatası: ${String(err)}`,
          });
          continue;
        }
        const result = validateScene(raw);
        for (const is of result.issues) {
          issues.push({
            severity: is.severity,
            file: rel(file),
            message: `${is.path}: ${is.message}`,
          });
        }
        if (result.ok && result.scene) scenes.push({ file: sf, scene: result.scene });
      }

      // Quiz
      let quiz: Quiz | null = null;
      let quizFile: string | null = null;
      const qf = join(lessonDir, 'quiz.json');
      if (existsSync(qf)) {
        try {
          const parsed = QuizSchema.safeParse(readJson(qf));
          if (parsed.success) {
            quiz = parsed.data;
            quizFile = 'quiz.json';
          } else {
            issues.push({
              severity: 'error',
              file: rel(qf),
              message: parsed.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; '),
            });
          }
        } catch (err) {
          issues.push({
            severity: 'error',
            file: rel(qf),
            message: `JSON parse hatası: ${String(err)}`,
          });
        }
      }

      // SVG'ler
      const svgs: Record<string, string> = {};
      for (const f of readdirSync(lessonDir).filter((x) => x.endsWith('.svg'))) {
        const content = readFileSync(join(lessonDir, f), 'utf8');
        if (!/<svg[\s>]/i.test(content)) {
          issues.push({
            severity: 'error',
            file: rel(join(lessonDir, f)),
            message: 'Geçerli bir <svg> kökü yok',
          });
          continue;
        }
        if (!/viewBox=/i.test(content)) {
          issues.push({
            severity: 'warning',
            file: rel(join(lessonDir, f)),
            message: 'viewBox yok; responsive ölçekleme için gerekli',
          });
        }
        // İstemci sanitizer'ı bunları siler; <style> kuralları satır içi SVG'de tüm sayfaya uygulanır
        const forbidden = content.match(/<(script|style|foreignObject)[\s>]/i);
        if (forbidden) {
          issues.push({
            severity: 'error',
            file: rel(join(lessonDir, f)),
            message: `<${forbidden[1]}> kullanılamaz; stilleri SVG öznitelikleri olarak yazın`,
          });
        }
        svgs[f] = content;
      }

      // Raster görseller (png, jpg, webp)
      const images: Record<string, LoadedImage> = {};
      for (const f of readdirSync(lessonDir).filter((x) => rasterExtension(x))) {
        const path = join(lessonDir, f);
        const buf = readFileSync(path);
        const size = readImageSize(buf);
        if (!size) {
          issues.push({
            severity: 'error',
            file: rel(path),
            message: 'Görsel okunamadı (geçerli bir PNG, JPEG ya da WebP değil)',
          });
          continue;
        }
        if (buf.length > MAX_IMAGE_BYTES) {
          issues.push({
            severity: 'error',
            file: rel(path),
            message: `Görsel çok büyük (${Math.round(buf.length / 1024 / 1024)} MB, en fazla 15 MB)`,
          });
          continue;
        }
        images[f] = { path, ...size, bytes: buf.length };
      }

      // Kod izleri: .trace.py kaynağından üretilir; kaynak değiştiyse iz yeniden üretilmeli
      const traces: Record<string, CodeTrace> = {};
      const files = readdirSync(lessonDir);
      for (const f of files.filter((x) => x.endsWith('.trace.py'))) {
        if (!files.includes(f.replace(/\.py$/, '.json'))) {
          issues.push({
            severity: 'error',
            file: rel(join(lessonDir, f)),
            message: 'İz üretilmemiş: pnpm content:traces',
          });
        }
      }
      for (const f of files.filter((x) => x.endsWith('.trace.json'))) {
        const file = join(lessonDir, f);
        let raw: unknown;
        try {
          raw = readJson(file);
        } catch (err) {
          issues.push({
            severity: 'error',
            file: rel(file),
            message: `JSON parse hatası: ${String(err)}`,
          });
          continue;
        }
        const parsed = CodeTraceSchema.safeParse(raw);
        if (!parsed.success) {
          issues.push({
            severity: 'error',
            file: rel(file),
            message: parsed.error.issues
              .slice(0, 5)
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; '),
          });
          continue;
        }
        const source = join(lessonDir, f.replace(/\.json$/, '.py'));
        if (!existsSync(source)) {
          issues.push({
            severity: 'error',
            file: rel(file),
            message: `Kaynak dosya yok: ${f.replace(/\.json$/, '.py')}`,
          });
        } else if (
          createHash('sha256').update(readFileSync(source)).digest('hex') !== parsed.data.sourceHash
        ) {
          issues.push({
            severity: 'error',
            file: rel(file),
            message: 'İz, kaynak .trace.py ile güncel değil: pnpm content:traces',
          });
        }
        traces[f] = parsed.data;
      }

      // İçerik kalitesi kontrolleri (uyarı; --strict ile hata)
      const rawMd = readFileSync(mdFile, 'utf8');
      if (
        /tüm hakları (yazarına|sahibine) aittir|not setinin \d+ sayfasından oluşur/i.test(rawMd)
      ) {
        issues.push({
          severity: 'error',
          file: rel(mdFile),
          message: 'Üçüncü taraf not seti ifadesi: ders özgün metinle yazılmalı (telif riski)',
        });
      }
      const proseWords = doc.blocks
        .filter((b) => b.type === 'text')
        .map((b) => (b.type === 'text' ? b.markdown : ''))
        .join(' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length;
      if (proseWords < MIN_PROSE_WORDS) {
        issues.push({
          severity: 'warning',
          file: rel(mdFile),
          message: `Düzyazı çok kısa (${proseWords} kelime, en az ${MIN_PROSE_WORDS} önerilir)`,
        });
      }
      if (doc.meta.order > 1 && doc.meta.prerequisites.length === 0) {
        issues.push({
          severity: 'warning',
          file: rel(mdFile),
          message:
            'Ön koşul tanımlı değil (prerequisites boş); ders ağı için en az bir ders bağlayın',
        });
      }
      for (const [f, img] of Object.entries(images)) {
        if (img.bytes > WARN_IMAGE_BYTES) {
          issues.push({
            severity: 'warning',
            file: rel(join(lessonDir, f)),
            message: `Görsel büyük (${Math.round(img.bytes / 1024)} KB, ${Math.round(WARN_IMAGE_BYTES / 1024)} KB üstü); webp ya da yeniden boyutlandırma önerilir`,
          });
        }
      }

      // Blok referansları
      for (const b of doc.blocks) {
        // Seed ve admin aynı şemayı kullanır; ayrıştırıcının ürettiği blok şemaya uymalı
        const blockParsed = LessonBlockSchema.safeParse(b);
        if (!blockParsed.success) {
          issues.push({
            severity: 'error',
            file: rel(mdFile),
            message: `':::${b.type}' (${b.id}) geçersiz → ${blockParsed.error.issues
              .slice(0, 5)
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; ')}`,
          });
        }
        if (b.type === 'predict' && !b.explanation) {
          issues.push({
            severity: 'warning',
            file: rel(mdFile),
            message: `':::predict{id=${b.id}}' açıklama içermiyor ('Açıklama:' satırı); öğrenci neden yanıldığını görmeli`,
          });
        }
        if (b.type === 'resources' && b.items.length > RESOURCES_SOFT_MAX) {
          issues.push({
            severity: 'warning',
            file: rel(mdFile),
            message: `':::resources' ${b.items.length} öğe içeriyor (en fazla ${RESOURCES_SOFT_MAX} önerilir); en değerli kaynakları seçin`,
          });
        }
        if (b.type === 'trace' && !traces[b.src]) {
          issues.push({
            severity: 'error',
            file: rel(mdFile),
            message: `İz dosyası bulunamadı ya da geçersiz: ${b.src}`,
          });
        }
        if (b.type === 'diagram' && images[b.src]) {
          const alt = typeof b.alt === 'string' ? b.alt : b.alt.en;
          if (!alt || typeof b.alt === 'string') {
            issues.push({
              severity: 'warning',
              file: rel(mdFile),
              message: `Raster görselin İngilizce alt metni yok (alt="tr|en"): ${b.src}`,
            });
          }
        }
        if (b.type === 'diagram' && !/^https?:\/\//.test(b.src) && !svgs[b.src] && !images[b.src]) {
          issues.push({
            severity: 'error',
            file: rel(mdFile),
            message: `Diyagram dosyası bulunamadı: ${b.src}`,
          });
        }
        if (b.type === 'animation' && !scenes.some((s) => s.file === b.scene)) {
          issues.push({
            severity: 'error',
            file: rel(mdFile),
            message: `Sahne dosyası bulunamadı ya da geçersiz: ${b.scene}`,
          });
        }
        if (b.type === 'quiz' && (!quiz || b.src !== quizFile)) {
          issues.push({
            severity: 'error',
            file: rel(mdFile),
            message: `Quiz dosyası bulunamadı ya da geçersiz: ${b.src}`,
          });
        }
        // Simülatörün okumadığı parametre sessizce yok sayılır; yönerge gerçek kontrollerle uyuşmaz
        if (b.type === 'interactive') {
          const allowed: readonly string[] = INTERACTIVE_PARAMS[b.interactive];
          const unknown = Object.keys(b.params ?? {}).filter((k) => !allowed.includes(k));
          if (unknown.length) {
            issues.push({
              severity: 'error',
              file: rel(mdFile),
              message: `':::interactive{type=${b.interactive}}' bilinmeyen parametre: ${unknown.join(', ')} (geçerli: ${allowed.join(', ')})`,
            });
          }
          // İz kullanan simülatör (predict-run): iz :::trace ile aynı yoldan çözülür, seed bloğa gömer
          if (TRACE_INTERACTIVES.includes(b.interactive)) {
            const src = interactiveTraceSrc(b);
            if (!src || !traces[src]) {
              issues.push({
                severity: 'error',
                file: rel(mdFile),
                message: src
                  ? `':::interactive{type=${b.interactive}}' iz dosyası bulunamadı ya da geçersiz: ${src}`
                  : `':::interactive{type=${b.interactive}}' src parametresi (ör. src="ornek.trace.json") zorunlu`,
              });
            }
          }
        }
      }
      if (
        quiz &&
        (quiz.questions.length < QUIZ_QUESTION_RANGE.min ||
          quiz.questions.length > QUIZ_QUESTION_RANGE.max)
      ) {
        issues.push({
          severity: 'error',
          file: rel(join(lessonDir, 'quiz.json')),
          message: `Quiz ${QUIZ_QUESTION_RANGE.min}–${QUIZ_QUESTION_RANGE.max} soru içermeli (şu an ${quiz.questions.length})`,
        });
      }

      lessons.push({ dir: lessonDir, doc, scenes, quiz, quizFile, svgs, images, traces });
    }

    lessons.sort((a, b) => a.doc.meta.order - b.doc.meta.order);
    modules.push({ dir: moduleDir, manifest, lessons });
  }

  modules.sort((a, b) => a.manifest.order - b.manifest.order);

  // "next" referansları ve ön koşullar var olan derslere işaret etmeli
  const allLessonIds = new Set(modules.flatMap((m) => m.lessons.map((l) => l.doc.meta.id)));
  const curriculumIds = new Set(CURRICULUM.flatMap((m) => m.lessons.map((l) => l.id)));
  for (const m of modules) {
    for (const l of m.lessons) {
      for (const b of l.doc.blocks) {
        if (b.type === 'next' && !allLessonIds.has(b.lesson) && !curriculumIds.has(b.lesson)) {
          issues.push({
            severity: 'error',
            file: rel(join(l.dir, 'lesson.md')),
            message: `':::next' bilinmeyen derse işaret ediyor: ${b.lesson}`,
          });
        }
      }
      for (const p of l.doc.meta.prerequisites) {
        if (!allLessonIds.has(p) && !curriculumIds.has(p)) {
          issues.push({
            severity: 'warning',
            file: rel(join(l.dir, 'lesson.md')),
            message: `Ön koşul bilinmeyen ders: ${p}`,
          });
        }
      }
    }
  }

  // Öğrenme yolu öğeleri ("modül" ya da "modül/ders") var olan içeriğe işaret etmeli
  const moduleLessons = new Map(
    modules.map((m) => [m.manifest.id, new Set(m.lessons.map((l) => l.doc.meta.id))]),
  );
  for (const p of paths) {
    for (const item of p.items) {
      const [moduleId, lessonId] = item.split('/');
      const lessonsOfModule = moduleLessons.get(moduleId);
      if (!lessonsOfModule)
        issues.push({
          severity: 'error',
          file: 'paths.json',
          message: `Yol '${p.id}': bilinmeyen modül ${moduleId}`,
        });
      else if (lessonId && !lessonsOfModule.has(lessonId))
        issues.push({
          severity: 'error',
          file: 'paths.json',
          message: `Yol '${p.id}': ${moduleId} modülünde bilinmeyen ders ${lessonId}`,
        });
    }
  }

  // Kavram sözlüğü: derslerde/quizlerde geçen her kavram tanımlı olmalı
  const { glossary, issues: glossaryIssues } = loadGlossary(root);
  issues.push(...glossaryIssues);
  if (glossary) {
    const lessons = modules.flatMap((m) => m.lessons);
    const index = buildConceptIndex(
      lessons.map((l) => ({ id: l.doc.meta.id, concepts: l.doc.meta.concepts })),
      lessons.flatMap((l) =>
        l.quiz ? [{ lessonId: l.doc.meta.id, questions: l.quiz.questions }] : [],
      ),
    );
    const lessonDir = new Map(lessons.map((l) => [l.doc.meta.id, l.dir]));
    for (const [concept, usage] of index) {
      if (!glossary[concept]) {
        // Dosya olarak sözlük gösterilir: seed, hatalı ders klasörlerini atlar; eksik tanım dersi düşürmemeli
        const dir = lessonDir.get(usage.lessons[0]);
        issues.push({
          severity: 'error',
          file: GLOSSARY_FILE,
          message: `Kavram sözlükte yok: ${concept}${dir ? ` (${rel(join(dir, 'lesson.md'))})` : ''}`,
        });
      }
    }
    for (const id of Object.keys(glossary)) {
      if (!index.has(id)) {
        issues.push({
          severity: 'warning',
          file: GLOSSARY_FILE,
          message: `Kavram hiçbir derste ya da quizde geçmiyor: ${id}`,
        });
      }
    }
  }

  return { root, paths, modules, glossary, issues };
}

/** Müfredat kapsama raporu: hangi dersler henüz yazılmamış */
export function coverageReport(content: LoadedContent): {
  total: number;
  written: number;
  missing: { moduleId: string; lessonId: string }[];
} {
  const written = new Set(content.modules.flatMap((m) => m.lessons.map((l) => l.doc.meta.id)));
  const missing: { moduleId: string; lessonId: string }[] = [];
  let total = 0;
  for (const m of CURRICULUM) {
    for (const l of m.lessons) {
      total += 1;
      if (!written.has(l.id)) missing.push({ moduleId: m.id, lessonId: l.id });
    }
  }
  return { total, written: total - missing.length, missing };
}

/** Çevrilebilir kısa metin alanları (başlık, altyazı, alt metin, yönerge) */
const LOCALIZED_KEYS = new Set(['title', 'summary', 'caption', 'alt', 'instructions']);

/**
 * İngilizce çeviri kapsamı. Doğrulama hatası/uyarısı değildir (--strict'i bozmaz); içerik ekibine
 * nerede çeviri eksik olduğunu gösterir. Web, gövdesi çevrilmemiş derste EN kullanıcısına not gösterir.
 */
export function translationReport(content: LoadedContent): {
  lessons: number;
  lessonsWithEnglishBody: number;
  untranslatedLessons: string[];
  localizedFields: number;
  localizedFieldsWithEnglish: number;
} {
  let lessons = 0;
  let lessonsWithEnglishBody = 0;
  const untranslatedLessons: string[] = [];
  let localizedFields = 0;
  let localizedFieldsWithEnglish = 0;

  const countField = (value: unknown) => {
    if (typeof value === 'string') localizedFields += 1;
    else if (value && typeof value === 'object' && 'tr' in value) {
      localizedFields += 1;
      if ((value as { en?: string }).en) localizedFieldsWithEnglish += 1;
    }
  };

  for (const m of content.modules) {
    for (const l of m.lessons) {
      lessons += 1;
      countField(l.doc.meta.title);
      countField(l.doc.meta.summary);
      for (const b of l.doc.blocks)
        for (const [k, v] of Object.entries(b)) if (LOCALIZED_KEYS.has(k)) countField(v);
      if (isLessonBodyTranslated(l.doc.blocks)) lessonsWithEnglishBody += 1;
      else untranslatedLessons.push(l.doc.meta.id);
    }
  }
  return {
    lessons,
    lessonsWithEnglishBody,
    untranslatedLessons,
    localizedFields,
    localizedFieldsWithEnglish,
  };
}
