-- Ders sürümünün kaynağı (seed / admin paneli) ve seed'in yazdığı content/ özeti.
-- Seed, panelde yayınlanmış sürümü content/ dosyası değişmedikçe ezmez.

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('seed', 'admin');

-- AlterTable
-- Mevcut sürümlerin kaynağı bilinmiyor: önceki davranış korunsun diye 'seed' sayılır
-- (seed bunları eskisi gibi günceller). Yeni satırların varsayılanı 'admin'dir.
ALTER TABLE "LessonVersion" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "source" "ContentSource" NOT NULL DEFAULT 'seed';

ALTER TABLE "LessonVersion" ALTER COLUMN "source" SET DEFAULT 'admin';
