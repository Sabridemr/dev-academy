-- Quizden çıkarılan sorular silinmek yerine arşivlenir (AttemptAnswer / ReviewCard geçmişi korunur)
ALTER TABLE "Question" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
