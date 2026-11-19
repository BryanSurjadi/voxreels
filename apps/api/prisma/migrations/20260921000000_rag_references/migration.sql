CREATE TABLE "ReferenceScript" (
    "id" UUID NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "creator" TEXT,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "niche" TEXT,
    "durationSeconds" INTEGER,
    "hookExcerpt" TEXT,
    "transcriptSummary" TEXT NOT NULL,
    "hookPattern" TEXT NOT NULL,
    "structureSummary" TEXT NOT NULL,
    "ctaStyle" TEXT,
    "whyItWorked" TEXT NOT NULL,
    "metrics" JSONB,
    "capturedAt" TIMESTAMP(3),
    "rightsStatus" TEXT NOT NULL DEFAULT 'derived_reference',
    "embeddingText" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferenceScript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScriptReference" (
    "scriptVersionId" UUID NOT NULL,
    "referenceScriptId" UUID NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "retrievalRank" INTEGER NOT NULL,
    CONSTRAINT "ScriptReference_pkey" PRIMARY KEY ("scriptVersionId", "referenceScriptId")
);

CREATE UNIQUE INDEX "ReferenceScript_sourceUrl_key" ON "ReferenceScript"("sourceUrl");
CREATE INDEX "ReferenceScript_language_niche_idx" ON "ReferenceScript"("language", "niche");
CREATE INDEX "ScriptReference_referenceScriptId_idx" ON "ScriptReference"("referenceScriptId");

ALTER TABLE "ScriptReference" ADD CONSTRAINT "ScriptReference_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "ScriptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptReference" ADD CONSTRAINT "ScriptReference_referenceScriptId_fkey" FOREIGN KEY ("referenceScriptId") REFERENCES "ReferenceScript"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
