import { prisma } from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

const MONTHLY_TEXT_TOKEN_LIMIT = { FREE: 40_000, PRO: 1_000_000 } as const;
const MONTHLY_GENERATION_CREDIT_LIMIT = { FREE: 5, PRO: 100 } as const;

function currentPeriod() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getUsage(workspaceId: string) {
  const periodStart = currentPeriod();
  const [workspace, usage] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { plan: true } }),
    prisma.aiTokenMonth.findUnique({ where: { workspaceId_periodStart: { workspaceId, periodStart } } }),
  ]);
  const limit = MONTHLY_TEXT_TOKEN_LIMIT[workspace.plan];
  const used = usage?.usedTokens ?? 0;
  const reserved = usage?.reservedTokens ?? 0;
  const creditLimit = MONTHLY_GENERATION_CREDIT_LIMIT[workspace.plan];
  const creditsUsed = usage?.usedCredits ?? 0;
  const creditsReserved = usage?.reservedCredits ?? 0;
  return {
    plan: workspace.plan,
    periodStart,
    limit,
    used,
    reserved,
    remaining: Math.max(0, limit - used - reserved),
    creditLimit,
    creditsUsed,
    creditsReserved,
    creditsRemaining: Math.max(0, creditLimit - creditsUsed - creditsReserved),
  };
}

function ensureMonth(workspaceId: string, periodStart: Date) {
  return prisma.aiTokenMonth.upsert({
    where: { workspaceId_periodStart: { workspaceId, periodStart } },
    create: { workspaceId, periodStart },
    update: {},
  });
}

export async function reserveTextTokens(workspaceId: string, reservation: number) {
  const { periodStart, limit } = await getUsage(workspaceId);
  await ensureMonth(workspaceId, periodStart);
  const updated = await prisma.$executeRaw`
    UPDATE "AiTokenMonth"
    SET "reservedTokens" = "reservedTokens" + ${reservation}
    WHERE "workspaceId" = ${workspaceId}::uuid
      AND "periodStart" = ${periodStart}::date
      AND "usedTokens" + "reservedTokens" + ${reservation} <= ${limit}
  `;
  if (updated !== 1) {
    throw new AppError(429, "MONTHLY_AI_TOKEN_LIMIT", "Monthly AI text-token allowance reached");
  }
  // ponytail: A process crash can leave this month's reservation held; add expiring per-call holds when background jobs arrive.
  return { workspaceId, periodStart, reservation };
}

export async function reserveGenerationCredits(workspaceId: string, count: number) {
  if (!Number.isInteger(count) || count < 1) throw new Error("Credit reservation must be positive");
  const { periodStart, creditLimit } = await getUsage(workspaceId);
  await ensureMonth(workspaceId, periodStart);
  const updated = await prisma.$executeRaw`
    UPDATE "AiTokenMonth"
    SET "reservedCredits" = "reservedCredits" + ${count}
    WHERE "workspaceId" = ${workspaceId}::uuid
      AND "periodStart" = ${periodStart}::date
      AND "usedCredits" + "reservedCredits" + ${count} <= ${creditLimit}
  `;
  if (updated !== 1) throw new AppError(429, "MONTHLY_GENERATION_LIMIT", "Not enough monthly generation credits remaining");
  // ponytail: A process crash can leave credits reserved until month-end; use expiring per-call holds for queued jobs.
  return { workspaceId, periodStart, count };
}

export async function settleGenerationCredits(
  reservation: Awaited<ReturnType<typeof reserveGenerationCredits>>,
  used: number,
) {
  if (!Number.isInteger(used) || used < 0 || used > reservation.count) throw new Error("Invalid credit settlement");
  await prisma.aiTokenMonth.update({
    where: { workspaceId_periodStart: { workspaceId: reservation.workspaceId, periodStart: reservation.periodStart } },
    data: {
      reservedCredits: { decrement: reservation.count },
      usedCredits: { increment: used },
    },
  });
}

export async function settleTextTokens(
  reservation: Awaited<ReturnType<typeof reserveTextTokens>>,
  actualTokens: number,
) {
  await prisma.aiTokenMonth.update({
    where: {
      workspaceId_periodStart: {
        workspaceId: reservation.workspaceId,
        periodStart: reservation.periodStart,
      },
    },
    data: {
      reservedTokens: { decrement: reservation.reservation },
      usedTokens: { increment: actualTokens },
    },
  });
}
