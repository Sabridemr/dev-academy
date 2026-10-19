-- Access token'ları toplu geçersiz kılmak için (şifre değişimi, tüm cihazlardan çıkış)
ALTER TABLE "User" ADD COLUMN "tokensValidAfter" TIMESTAMP(3);
