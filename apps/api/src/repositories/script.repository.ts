import { prisma } from "../config/prisma.js";
import type { GeneratedScript } from "../schemas/script.schema.js";

export function findProject(workspaceId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true,
      name: true,
      topic: true,
      goal: true,
      offer: true,
      callToAction: true,
      targetDurationSeconds: true,
      status: true,
      brand: { select: { name: true } },
    },
  });
}

export function countGeneratedSince(userId: string, since: Date) {
  return prisma.scriptVersion.count({
    where: {
      createdById: userId,
      origin: "generated",
      createdAt: { gte: since },
    },
  });
}

export function beginGeneration(workspaceId: string, projectId: string) {
  return prisma.project.updateMany({
    where: {
      id: projectId,
      workspaceId,
      status: { notIn: ["generating_script", "generating_assets", "exporting"] },
    },
    data: { status: "generating_script" },
  });
}

export function restoreProjectStatus(
  workspaceId: string,
  projectId: string,
  status: string,
) {
  return prisma.project.updateMany({
    where: { id: projectId, workspaceId, status: "generating_script" },
    data: { status },
  });
}

export function saveGeneratedScript(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  model: string;
  providerResponseId: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  script: GeneratedScript;
}) {
  return prisma.$transaction(async (transaction) => {
    const latest = await transaction.scriptVersion.aggregate({
      where: { projectId: input.projectId },
      _max: { version: true },
    });

    const scriptVersion = await transaction.scriptVersion.create({
      data: {
        projectId: input.projectId,
        createdById: input.userId,
        version: (latest._max.version ?? 0) + 1,
        origin: "generated",
        status: "draft",
        content: input.script.beats.map((beat) => beat.voiceover).join("\n\n"),
        model: input.model,
        providerResponseId: input.providerResponseId,
        ...(input.inputTokens !== undefined && { inputTokens: input.inputTokens }),
        ...(input.outputTokens !== undefined && { outputTokens: input.outputTokens }),
        ...(input.totalTokens !== undefined && { totalTokens: input.totalTokens }),
        beats: {
          create: input.script.beats.map((beat, order) => ({
            order,
            ...beat,
          })),
        },
      },
      include: { beats: { orderBy: { order: "asc" } } },
    });

    await transaction.project.update({
      where: { id: input.projectId, workspaceId: input.workspaceId },
      data: { name: input.script.title, status: "script_review" },
    });

    return scriptVersion;
  });
}
