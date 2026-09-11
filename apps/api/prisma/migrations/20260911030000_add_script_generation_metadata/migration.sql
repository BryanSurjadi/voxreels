-- AlterTable
ALTER TABLE "ScriptVersion" ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "providerResponseId" TEXT,
ADD COLUMN     "totalTokens" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ScriptVersion_providerResponseId_key" ON "ScriptVersion"("providerResponseId");
