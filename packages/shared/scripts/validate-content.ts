/**
 * content/ klasörünü doğrular ve müfredat kapsama raporu üretir.
 * Çalıştır: pnpm content:validate  (kökten)
 * Çıkış kodu: hata varsa 1.
 *
 * Seçenekler:
 *   --strict   uyarıları da hata say
 *   --json     makine okunur çıktı
 */
import {
  loadContent,
  coverageReport,
  findContentRoot,
  translationReport,
} from '../src/node/content-loader';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const asJson = args.has('--json');

const root = findContentRoot();
const content = loadContent(root);
const coverage = coverageReport(content);
const translation = translationReport(content);

const errors = content.issues.filter((i) => i.severity === 'error');
const warnings = content.issues.filter((i) => i.severity === 'warning');

const sceneCount = content.modules.reduce(
  (a, m) => a + m.lessons.reduce((b, l) => b + l.scenes.length, 0),
  0,
);
const quizCount = content.modules.reduce((a, m) => a + m.lessons.filter((l) => l.quiz).length, 0);
const svgCount = content.modules.reduce(
  (a, m) => a + m.lessons.reduce((b, l) => b + Object.keys(l.svgs).length, 0),
  0,
);
const interactiveCount = content.modules.reduce(
  (a, m) =>
    a +
    m.lessons.reduce((b, l) => b + l.doc.blocks.filter((x) => x.type === 'interactive').length, 0),
  0,
);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        root,
        coverage,
        translation,
        counts: { sceneCount, quizCount, svgCount, interactiveCount },
        errors,
        warnings,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`İçerik kökü: ${root}`);
  console.log(
    `Modül: ${content.modules.length}  Ders: ${coverage.written}/${coverage.total}  Sahne: ${sceneCount}  Quiz: ${quizCount}  SVG: ${svgCount}  İnteraktif: ${interactiveCount}`,
  );
  // Bilgi amaçlı (doğrulama sonucunu etkilemez)
  console.log(
    `İngilizce: ders gövdesi ${translation.lessonsWithEnglishBody}/${translation.lessons}, ` +
      `başlık/altyazı ${translation.localizedFieldsWithEnglish}/${translation.localizedFields}`,
  );
  if (coverage.missing.length) {
    console.log(`\nEksik dersler (${coverage.missing.length}):`);
    for (const m of coverage.missing) console.log(`  - ${m.moduleId}/${m.lessonId}`);
  }
  if (warnings.length) {
    console.log(`\nUyarılar (${warnings.length}):`);
    for (const w of warnings) console.log(`  ⚠ ${w.file}: ${w.message}`);
  }
  if (errors.length) {
    console.log(`\nHatalar (${errors.length}):`);
    for (const e of errors) console.log(`  ✗ ${e.file}: ${e.message}`);
  }
  console.log(
    errors.length === 0 && (!strict || warnings.length === 0)
      ? '\n✓ İçerik geçerli'
      : '\n✗ İçerik doğrulaması başarısız',
  );
}

process.exit(errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0);
