-- Kavram sözlüğü: content/concepts.json seed ile yüklenir, GET /concepts ile sunulur

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "term" JSONB NOT NULL,
    "definition" JSONB NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "related" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);
