CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO');

ALTER TABLE "Workspace" ADD COLUMN "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE';

CREATE TABLE "AiTokenMonth" (
    "workspaceId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "reservedTokens" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AiTokenMonth_pkey" PRIMARY KEY ("workspaceId","periodStart")
);

ALTER TABLE "AiTokenMonth" ADD CONSTRAINT "AiTokenMonth_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
