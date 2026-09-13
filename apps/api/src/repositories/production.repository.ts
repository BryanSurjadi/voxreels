import { prisma } from "../config/prisma.js";

export function findApprovedProject(workspaceId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      brand: true,
      scriptVersions: {
        where: { status: "approved" },
        orderBy: { approvedAt: "desc" },
        take: 1,
        include: {
          beats: {
            orderBy: { order: "asc" },
            include: {
              voiceTakes: { where: { status: "ready" }, orderBy: { createdAt: "desc" } },
              mediaLinks: {
                where: { purpose: "b_roll" },
                include: { mediaAsset: true },
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
      timelines: { orderBy: { version: "desc" }, take: 1, include: { items: true } },
    },
  });
}

export function createVoiceTake(scriptBeatId: string, model: string, voiceId: string, characterCount: number) {
  return prisma.voiceTake.create({
    data: { scriptBeatId, provider: "elevenlabs", model, voiceId, characterCount },
  });
}

export function completeVoiceTake(id: string, storageKey: string, providerJobId: string | null) {
  return prisma.voiceTake.update({ where: { id }, data: { status: "ready", storageKey, providerJobId } });
}

export function attachVoiceToTimelines(scriptBeatId: string, voiceTakeId: string) {
  return prisma.timelineItem.updateMany({
    where: { scriptBeatId, trackType: "voice", voiceTakeId: null },
    data: { voiceTakeId },
  });
}

export function failVoiceTake(id: string, errorMessage: string) {
  return prisma.voiceTake.update({ where: { id }, data: { status: "failed", errorMessage } });
}

export function createPendingBroll(workspaceId: string, projectId: string, beatId: string, name: string, model: string) {
  return prisma.mediaAsset.create({
    data: {
      workspaceId,
      projectId,
      name,
      kind: "image",
      sourceType: "generated",
      status: "pending",
      provider: "openai",
      provenance: "ai_generated",
      metadata: { beatId, model, quality: "low" },
    },
  });
}

export function completeBroll(id: string, beatId: string, storageKey: string, prompt: string) {
  return prisma.$transaction([
    prisma.mediaAsset.update({
      where: { id },
      data: { status: "ready", storageKey, mimeType: "image/png", metadata: { beatId, prompt, model: "gpt-image-2.5-flare", quality: "low" } },
    }),
    prisma.beatMediaAsset.create({ data: { scriptBeatId: beatId, mediaAssetId: id, purpose: "b_roll" } }),
  ]).then(([asset]) => asset);
}

export function attachMediaToTimelines(scriptBeatId: string, mediaAssetId: string) {
  return prisma.timelineItem.updateMany({
    where: { scriptBeatId, trackType: "visual", mediaAssetId: null },
    data: { mediaAssetId },
  });
}

export function failBroll(id: string, message: string) {
  return prisma.mediaAsset.update({ where: { id }, data: { status: "failed", metadata: { error: message } } });
}

export function setProjectStatus(workspaceId: string, projectId: string, status: string) {
  return prisma.project.updateMany({ where: { id: projectId, workspaceId }, data: { status } });
}

export function createTimeline(projectId: string, scriptVersionId: string, name: string, durationMs: number, items: Array<{
  scriptBeatId: string;
  mediaAssetId?: string;
  voiceTakeId?: string;
  trackType: string;
  trackIndex: number;
  order: number;
  startMs: number;
  durationMs: number;
  text?: string;
}>) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.timeline.findFirst({ where: { projectId, scriptVersionId }, orderBy: { version: "desc" }, include: { items: true } });
    if (existing) return existing;
    const latest = await tx.timeline.aggregate({ where: { projectId }, _max: { version: true } });
    return tx.timeline.create({
      data: { projectId, scriptVersionId, version: (latest._max.version ?? 0) + 1, name, durationMs, items: { create: items } },
      include: { items: { orderBy: [{ trackIndex: "asc" }, { order: "asc" }] } },
    });
  });
}

export function updateTimeline(workspaceId: string, projectId: string, timelineId: string, items: Array<{ id: string; startMs: number; durationMs: number }>) {
  return prisma.$transaction(async (tx) => {
    const timeline = await tx.timeline.findFirst({ where: { id: timelineId, projectId, project: { workspaceId } }, include: { items: true } });
    if (!timeline || items.some((item) => !timeline.items.some((existing) => existing.id === item.id))) return null;
    await Promise.all(items.map((item) => tx.timelineItem.update({ where: { id: item.id }, data: { startMs: item.startMs, durationMs: item.durationMs } })));
    const durationMs = Math.max(...items.map((item) => item.startMs + item.durationMs));
    return tx.timeline.update({ where: { id: timelineId }, data: { durationMs }, include: { items: { orderBy: [{ trackIndex: "asc" }, { order: "asc" }] } } });
  });
}

export function createUploadedMedia(workspaceId: string, projectId: string, name: string, kind: string, mimeType: string, storageKey: string) {
  return prisma.mediaAsset.create({
    data: { workspaceId, projectId, name, kind, mimeType, storageKey, sourceType: "upload", status: "ready", provenance: "user_uploaded" },
  });
}

export function addMediaToTimeline(workspaceId: string, projectId: string, timelineId: string, input: { mediaAssetId: string; trackType: "visual" | "audio"; startMs: number; durationMs: number }) {
  return prisma.$transaction(async (tx) => {
    const [timeline, asset] = await Promise.all([
      tx.timeline.findFirst({ where: { id: timelineId, projectId, project: { workspaceId } } }),
      tx.mediaAsset.findFirst({ where: { id: input.mediaAssetId, projectId, workspaceId, status: "ready" } }),
    ]);
    if (!timeline || !asset) return null;
    const trackIndex = input.trackType === "audio" ? 3 : 1;
    const latest = await tx.timelineItem.aggregate({ where: { timelineId, trackIndex }, _max: { order: true } });
    return tx.timelineItem.create({
      data: { timelineId, mediaAssetId: asset.id, trackType: input.trackType, trackIndex, order: (latest._max.order ?? -1) + 1, startMs: input.startMs, durationMs: input.durationMs },
    });
  });
}

export function findVoiceMedia(workspaceId: string, projectId: string, mediaId: string) {
  return prisma.voiceTake.findFirst({
    where: { id: mediaId, scriptBeat: { scriptVersion: { project: { id: projectId, workspaceId } } } },
  });
}

export function findBrollMedia(workspaceId: string, projectId: string, mediaId: string) {
  return prisma.mediaAsset.findFirst({ where: { id: mediaId, projectId, workspaceId } });
}

export function createExport(projectId: string, timelineId: string | undefined, metadata: object) {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.export.aggregate({ where: { projectId, type: "project_json" }, _max: { version: true } });
    return tx.export.create({
      data: { projectId, timelineId: timelineId ?? null, version: (latest._max.version ?? 0) + 1, type: "project_json", status: "complete", metadata },
    });
  });
}
