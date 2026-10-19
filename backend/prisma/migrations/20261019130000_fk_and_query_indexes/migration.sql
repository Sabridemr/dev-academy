-- Yabancı anahtar indeksleri (cascade silmelerde tam tarama olmasın) ve sık filtrelenen sütunlar

-- CreateIndex
CREATE INDEX "AnimationScene_authorId_idx" ON "AnimationScene"("authorId");

-- CreateIndex
CREATE INDEX "Attempt_quizId_idx" ON "Attempt"("quizId");

-- CreateIndex
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");

-- CreateIndex
CREATE INDEX "Bookmark_lessonId_idx" ON "Bookmark"("lessonId");

-- CreateIndex
CREATE INDEX "LearningPathItem_moduleId_idx" ON "LearningPathItem"("moduleId");

-- CreateIndex
CREATE INDEX "LearningPathItem_lessonId_idx" ON "LearningPathItem"("lessonId");

-- CreateIndex
CREATE INDEX "LessonVersion_authorId_idx" ON "LessonVersion"("authorId");

-- CreateIndex
CREATE INDEX "Progress_lessonId_idx" ON "Progress"("lessonId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ReviewCard_questionId_idx" ON "ReviewCard"("questionId");

-- CreateIndex
CREATE INDEX "ReviewCard_lessonId_idx" ON "ReviewCard"("lessonId");

-- CreateIndex
CREATE INDEX "User_reminderHour_idx" ON "User"("reminderHour");

