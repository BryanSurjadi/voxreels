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

export function completeVoiceTake(id: string, storageKey: string, providerJobId: string | null, durationMs: number) {
  return prisma.voiceTake.update({ where: { id }, data: { status: "ready", storageKey, providerJobId, durationMs } });
}

export function setVoiceDuration(id: string, durationMs: number) {
  return prisma.voiceTake.update({ where: { id }, data: { durationMs } });
}

export function attachVoiceToTimelines(scriptBeatId: string, voiceTakeId: string, previousVoiceTakeId?: string) {
  return prisma.timelineItem.updateMany({
    where: { scriptBeatId, trackType: "voice", OR: [{ voiceTakeId: null }, ...(previousVoiceTakeId ? [{ voiceTakeId: previousVoiceTakeId }] : [])] },
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

export function beginAssetGeneration(workspaceId: string, projectId: string) {
  return prisma.project.updateMany({
    where: { id: projectId, workspaceId, status: { notIn: ["generating_script", "generating_assets", "exporting"] } },
    data: { status: "generating_assets" },
  });
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

export function updateTimeline(workspaceId: string, projectId: string, timelineId: string, items: Array<{ id: string; startMs: number; durationMs: number; trimStartMs: number; text: string | null }>) {
  return prisma.$transaction(async (tx) => {
    const timeline = await tx.timeline.findFirst({ where: { id: timelineId, projectId, project: { workspaceId } }, include: { items: true } });
    if (!timeline || new Set(items.map((item) => item.id)).size !== items.length || items.some((item) => !timeline.items.some((existing) => existing.id === item.id && (existing.trackType === "text" || item.text === existing.text)))) return null;
    await tx.timelineItem.deleteMany({ where: { timelineId, id: { notIn: items.map((item) => item.id) } } });
    await Promise.all(items.map((item) => tx.timelineItem.update({ where: { id: item.id }, data: { startMs: item.startMs, durationMs: item.durationMs, trimStartMs: item.trimStartMs, ...(item.text !== null && { text: item.text }) } })));
    const durationMs = Math.max(1000, ...items.map((item) => item.startMs + item.durationMs));
    return tx.timeline.update({ where: { id: timelineId }, data: { durationMs }, include: { items: { orderBy: [{ trackIndex: "asc" }, { order: "asc" }] } } });
  });
}

export function realignGeneratedTimeline(workspaceId: string, projectId: string, timelineId: string, beats: Array<{ id: string; startMs: number; durationMs: number }>) {
  return prisma.$transaction(async (tx) => {
    const timeline = await tx.timeline.findFirst({ where: { id: timelineId, projectId, project: { workspaceId } }, include: { items: true } });
    if (!timeline) return null;
    const generated = timeline.items.filter((item) => item.scriptBeatId && ["voice", "visual", "text"].includes(item.trackType));
    if (generated.length !== beats.length * 3 || beats.some((beat) => ["voice", "visual", "text"].some((trackType) => generated.filter((item) => item.scriptBeatId === beat.id && item.trackType === trackType).length !== 1))) return false;
    for (const beat of beats) {
      await tx.timelineItem.updateMany({
        where: { timelineId, scriptBeatId: beat.id, trackType: { in: ["voice", "visual", "text"] } },
        data: { startMs: beat.startMs, durationMs: beat.durationMs, trimStartMs: 0 },
      });
    }
    const items = await tx.timelineItem.findMany({ where: { timelineId } });
    const beatStarts = new Map(beats.map((beat) => [beat.id, beat.startMs + beat.durationMs]));
    return tx.timeline.update({
      where: { id: timelineId },
      data: { durationMs: Math.max(1000, ...items.map((item) => item.scriptBeatId && ["voice", "visual", "text"].includes(item.trackType) ? beatStarts.get(item.scriptBeatId)! : item.startMs + item.durationMs)) },
      include: { items: { orderBy: [{ trackIndex: "asc" }, { order: "asc" }] } },
    });
  });
}

export function createUploadedMedia(workspaceId: string, projectId: string, name: string, kind: string, mimeType: string, storageKey: string) {
  return prisma.mediaAsset.create({
    data: { workspaceId, projectId, name, kind, mimeType, storageKey, sourceType: "upload", status: "ready", provenance: "user_uploaded" },
  });
}

export function addMediaToTimeline(workspaceId: string, projectId: string, timelineId: string, input: { mediaAssetId: string; trackType: "visual" | "audio"; startMs: number; durationMs: number } | { trackType: "text"; text: string; startMs: number; durationMs: number }) {
  return prisma.$transaction(async (tx) => {
    const timeline = await tx.timeline.findFirst({ where: { id: timelineId, projectId, project: { workspaceId } } });
    const asset = input.trackType === "text" ? null : await tx.mediaAsset.findFirst({ where: { id: input.mediaAssetId, projectId, workspaceId, status: "ready", kind: { in: input.trackType === "visual" ? ["image", "video"] : ["audio"] } } });
    if (!timeline || (input.trackType !== "text" && !asset)) return null;
    const trackIndex = input.trackType === "audio" ? 3 : input.trackType === "text" ? 2 : 1;
    const latest = await tx.timelineItem.aggregate({ where: { timelineId, trackIndex }, _max: { order: true } });
    return tx.timelineItem.create({
      data: { timelineId, ...(asset && { mediaAssetId: asset.id }), ...(input.trackType === "text" && { text: input.text }), trackType: input.trackType, trackIndex, order: (latest._max.order ?? -1) + 1, startMs: input.startMs, durationMs: input.durationMs },
    });
  });
}

export function splitTimelineItem(workspaceId: string, projectId: string, timelineId: string, itemId: string, atMs: number) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.timelineItem.findFirst({ where: { id: itemId, timelineId, timeline: { projectId, project: { workspaceId } } }, include: { mediaAsset: true } });
    if (!item || atMs - item.startMs < 100 || item.startMs + item.durationMs - atMs < 100) return null;
    const leftDuration = atMs - item.startMs;
    const latest = await tx.timelineItem.aggregate({ where: { timelineId, trackIndex: item.trackIndex }, _max: { order: true } });
    await tx.timelineItem.update({ where: { id: item.id }, data: { durationMs: leftDuration } });
    return tx.timelineItem.create({ data: {
      timelineId, scriptBeatId: item.scriptBeatId, mediaAssetId: item.mediaAssetId, voiceTakeId: item.voiceTakeId,
      trackType: item.trackType, trackIndex: item.trackIndex, order: (latest._max.order ?? -1) + 1,
      startMs: atMs, durationMs: item.durationMs - leftDuration,
      trimStartMs: item.trimStartMs + (item.trackType === "voice" || item.trackType === "audio" || item.mediaAsset?.kind === "video" ? leftDuration : 0),
      volume: item.volume, positionX: item.positionX, positionY: item.positionY, scale: item.scale, zIndex: item.zIndex, text: item.text,
    } });
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

export function findTimelineForRender(workspaceId: string, projectId: string) {
  return prisma.timeline.findFirst({
    where: { projectId, project: { workspaceId } },
    orderBy: { version: "desc" },
    include: {
      project: { select: { name: true } },
      items: {
        orderBy: [{ trackIndex: "asc" }, { order: "asc" }],
        include: { mediaAsset: true, voiceTake: true },
      },
    },
  });
}

export async function createPendingVideoExport(projectId: string, timelineId: string) {
  const latest = await prisma.export.aggregate({ where: { projectId, type: "video_mp4" }, _max: { version: true } });
  return prisma.export.create({ data: { projectId, timelineId, version: (latest._max.version ?? 0) + 1, type: "video_mp4" } });
}

export function findExport(workspaceId: string, projectId: string, exportId: string) {
  return prisma.export.findFirst({ where: { id: exportId, projectId, project: { workspaceId }, status: "complete" } });
}

export function completeVideoExport(id: string, storageKey: string, metadata: object) {
  return prisma.export.update({ where: { id }, data: { status: "complete", storageKey, metadata } });
}

export function failVideoExport(id: string, message: string) {
  return prisma.export.update({ where: { id }, data: { status: "failed", metadata: { error: message } } });
}
