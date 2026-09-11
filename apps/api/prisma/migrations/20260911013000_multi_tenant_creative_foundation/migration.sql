-- Convert the original single-workspace user link into memberships without losing data.
ALTER TABLE "User" DROP CONSTRAINT "User_workspaceId_fkey";
DROP INDEX "User_workspaceId_idx";

ALTER TABLE "Project"
ADD COLUMN "callToAction" TEXT,
ADD COLUMN "createdById" UUID,
ADD COLUMN "offer" TEXT,
ADD COLUMN "targetDurationSeconds" INTEGER,
ADD COLUMN "topic" TEXT;

CREATE TABLE "WorkspaceMembership" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WorkspaceMembership" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "workspaceId", "id", "role", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User";

ALTER TABLE "RefreshToken" ADD COLUMN "workspaceId" UUID;

UPDATE "RefreshToken" AS token
SET "workspaceId" = app_user."workspaceId"
FROM "User" AS app_user
WHERE token."userId" = app_user."id";

ALTER TABLE "RefreshToken" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "User" DROP COLUMN "role", DROP COLUMN "workspaceId";

CREATE TABLE "ScriptVersion" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "createdById" UUID,
    "version" INTEGER NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'generated',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScriptBeat" (
    "id" UUID NOT NULL,
    "scriptVersionId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "role" TEXT,
    "voiceover" TEXT NOT NULL,
    "delivery" TEXT,
    "onScreenText" TEXT,
    "visualRequirement" TEXT,
    "truthRequirement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptBeat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceTake" (
    "id" UUID NOT NULL,
    "scriptBeatId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "providerJobId" TEXT,
    "storageKey" TEXT,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "speed" DOUBLE PRECISION,
    "stability" DOUBLE PRECISION,
    "similarity" DOUBLE PRECISION,
    "style" DOUBLE PRECISION,
    "approvedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VoiceTake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "storageKey" TEXT,
    "mimeType" TEXT,
    "durationMs" INTEGER,
    "provider" TEXT,
    "providerJobId" TEXT,
    "provenance" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BeatMediaAsset" (
    "id" UUID NOT NULL,
    "scriptBeatId" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "purpose" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BeatMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Timeline" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "scriptVersionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "canvasWidth" INTEGER NOT NULL DEFAULT 1080,
    "canvasHeight" INTEGER NOT NULL DEFAULT 1920,
    "framesPerSecond" INTEGER NOT NULL DEFAULT 30,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Timeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimelineItem" (
    "id" UUID NOT NULL,
    "timelineId" UUID NOT NULL,
    "scriptBeatId" UUID,
    "mediaAssetId" UUID,
    "voiceTakeId" UUID,
    "trackType" TEXT NOT NULL,
    "trackIndex" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "trimStartMs" INTEGER NOT NULL DEFAULT 0,
    "trimEndMs" INTEGER,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "transitionIn" TEXT,
    "transitionOut" TEXT,
    "text" TEXT,
    "style" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimelineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Export" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "timelineId" UUID,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "storageKey" TEXT,
    "providerJobId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceMembership_userId_idx" ON "WorkspaceMembership"("userId");
CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");
CREATE INDEX "ScriptVersion_createdById_idx" ON "ScriptVersion"("createdById");
CREATE UNIQUE INDEX "ScriptVersion_projectId_version_key" ON "ScriptVersion"("projectId", "version");
CREATE UNIQUE INDEX "ScriptBeat_scriptVersionId_order_key" ON "ScriptBeat"("scriptVersionId", "order");
CREATE INDEX "VoiceTake_scriptBeatId_idx" ON "VoiceTake"("scriptBeatId");
CREATE INDEX "VoiceTake_providerJobId_idx" ON "VoiceTake"("providerJobId");
CREATE INDEX "MediaAsset_workspaceId_idx" ON "MediaAsset"("workspaceId");
CREATE INDEX "MediaAsset_projectId_idx" ON "MediaAsset"("projectId");
CREATE INDEX "MediaAsset_providerJobId_idx" ON "MediaAsset"("providerJobId");
CREATE INDEX "BeatMediaAsset_mediaAssetId_idx" ON "BeatMediaAsset"("mediaAssetId");
CREATE UNIQUE INDEX "BeatMediaAsset_scriptBeatId_mediaAssetId_key" ON "BeatMediaAsset"("scriptBeatId", "mediaAssetId");
CREATE INDEX "Timeline_scriptVersionId_idx" ON "Timeline"("scriptVersionId");
CREATE UNIQUE INDEX "Timeline_projectId_version_key" ON "Timeline"("projectId", "version");
CREATE INDEX "TimelineItem_scriptBeatId_idx" ON "TimelineItem"("scriptBeatId");
CREATE INDEX "TimelineItem_mediaAssetId_idx" ON "TimelineItem"("mediaAssetId");
CREATE INDEX "TimelineItem_voiceTakeId_idx" ON "TimelineItem"("voiceTakeId");
CREATE UNIQUE INDEX "TimelineItem_timelineId_trackIndex_order_key" ON "TimelineItem"("timelineId", "trackIndex", "order");
CREATE INDEX "Export_timelineId_idx" ON "Export"("timelineId");
CREATE INDEX "Export_providerJobId_idx" ON "Export"("providerJobId");
CREATE UNIQUE INDEX "Export_projectId_version_type_key" ON "Export"("projectId", "version", "type");
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");
CREATE INDEX "RefreshToken_workspaceId_idx" ON "RefreshToken"("workspaceId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptVersion" ADD CONSTRAINT "ScriptVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScriptVersion" ADD CONSTRAINT "ScriptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScriptBeat" ADD CONSTRAINT "ScriptBeat_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "ScriptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceTake" ADD CONSTRAINT "VoiceTake_scriptBeatId_fkey" FOREIGN KEY ("scriptBeatId") REFERENCES "ScriptBeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BeatMediaAsset" ADD CONSTRAINT "BeatMediaAsset_scriptBeatId_fkey" FOREIGN KEY ("scriptBeatId") REFERENCES "ScriptBeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BeatMediaAsset" ADD CONSTRAINT "BeatMediaAsset_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timeline" ADD CONSTRAINT "Timeline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timeline" ADD CONSTRAINT "Timeline_scriptVersionId_fkey" FOREIGN KEY ("scriptVersionId") REFERENCES "ScriptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimelineItem" ADD CONSTRAINT "TimelineItem_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineItem" ADD CONSTRAINT "TimelineItem_scriptBeatId_fkey" FOREIGN KEY ("scriptBeatId") REFERENCES "ScriptBeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimelineItem" ADD CONSTRAINT "TimelineItem_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimelineItem" ADD CONSTRAINT "TimelineItem_voiceTakeId_fkey" FOREIGN KEY ("voiceTakeId") REFERENCES "VoiceTake"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Export" ADD CONSTRAINT "Export_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Export" ADD CONSTRAINT "Export_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
