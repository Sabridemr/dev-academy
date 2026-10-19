-- Ders düzeyindeki yer imleri NULL yerine '' ile tutulur: unique kısıtta NULL'lar ayrı sayıldığından
-- aynı ders için kopya yer imi oluşabiliyordu. Önce mevcut kopyalar (en eskisi kalır) temizlenir.
DELETE FROM "Bookmark" b
USING "Bookmark" d
WHERE b."blockId" IS NULL
  AND d."blockId" IS NULL
  AND b."userId" = d."userId"
  AND b."lessonId" = d."lessonId"
  AND (b."createdAt", b."id") > (d."createdAt", d."id");

UPDATE "Bookmark" SET "blockId" = '' WHERE "blockId" IS NULL;

-- AlterTable
ALTER TABLE "Bookmark" ALTER COLUMN "blockId" SET NOT NULL,
ALTER COLUMN "blockId" SET DEFAULT '';
