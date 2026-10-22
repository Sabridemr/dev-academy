/**
 * İÇERİK DIŞA AKTARIMI (veritabanı → content/)
 * --------------------------------------------
 * Admin panelinde düzenlenip yayınlanan dersleri seed'in okuduğu dosya biçimine geri yazar
 * (lesson.md, *.svg, *.scene.json, quiz.json, *.trace.json, raster görseller). Seed'in tersidir;
 * çıktı `pnpm content:validate --strict` ile doğrulanıp commit'lenebilir.
 *
 * Çalıştır:
 *   pnpm --filter @devacademy/backend content:export                 # yayındaki tüm dersler
 *   pnpm --filter @devacademy/backend content:export --lesson <id>   # tek ders (tekrarlanabilir)
 *   pnpm --filter @devacademy/backend content:export --out /tmp/x    # başka klasöre (varsayılan CONTENT_DIR)
 *
 * Yalnızca dersin klasöründeki dosyaları yazar/üzerine yazar; klasörde olup dışa aktarımda olmayan
 * dosyaları (ör. *.trace.py kaynakları, kullanılmayan eski görseller) silmez.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { rasterExtension } from '@devacademy/shared';
import { ContentExportService } from '../src/modules/admin/content-export.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

function parseArgs(argv: string[]): { lessons: string[]; out: string } {
  const lessons: string[] = [];
  let out = resolve(process.cwd(), process.env.CONTENT_DIR ?? '../content');
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--lesson' && argv[i + 1]) lessons.push(argv[++i]);
    else if (arg === '--out' && argv[i + 1]) out = resolve(process.cwd(), argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log('Kullanım: content:export [--lesson <id>]... [--out <klasör>]');
      process.exit(0);
    } else if (arg !== '--') {
      console.error(`Bilinmeyen argüman: ${arg}`);
      process.exit(2);
    }
  }
  return { lessons, out };
}

/** Hedef ders klasöründe aynı içerikli raster görsel varsa adını koru (gereksiz yeniden adlandırma olmasın) */
function existingAssetNames(lessonDir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(lessonDir)) return out;
  for (const f of readdirSync(lessonDir).filter((x) => rasterExtension(x))) {
    const sha = createHash('sha256')
      .update(readFileSync(join(lessonDir, f)))
      .digest('hex');
    out.set(sha, f);
  }
  return out;
}

async function main(): Promise<void> {
  const { lessons, out } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const exporter = new ContentExportService(prisma as unknown as PrismaService);
    const ids = lessons.length ? lessons : await exporter.publishedLessonIds();
    console.log(`Hedef: ${out} (${ids.length} ders)`);
    let written = 0;
    let warningCount = 0;
    for (const id of ids) {
      const lesson = await prisma.lesson.findUnique({ where: { id }, select: { moduleId: true } });
      const lessonDir = lesson ? join(out, 'modules', lesson.moduleId, id) : '';
      const assets = lessonDir ? existingAssetNames(lessonDir) : new Map<string, string>();
      const result = await exporter.exportLesson(id, {
        assetFileName: (sha) => assets.get(sha),
      });
      for (const f of result.files) {
        const target = join(out, f.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, Buffer.from(f.content, f.encoding === 'base64' ? 'base64' : 'utf8'));
        written += 1;
      }
      // İz kaynağı veritabanında yok: hedefte mevcutsa sorun değil, yoksa kullanıcıyı uyar
      const warnings = result.warnings.filter((w) => {
        const m = /'([^']+\.trace\.py)' veritabanında tutulmaz/.exec(w);
        return !m || !existsSync(join(out, 'modules', result.moduleId, id, m[1]));
      });
      console.log(`✓ ${id} (v${result.version}, ${result.status}): ${result.files.length} dosya`);
      for (const w of warnings) console.warn(`  ⚠ ${w}`);
      warningCount += warnings.length;
    }
    console.log(`✓ ${written} dosya yazıldı, ${warningCount} uyarı`);
    console.log(
      'Sonraki adım: pnpm content:validate --strict ve git diff ile değişiklikleri gözden geçirin',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
