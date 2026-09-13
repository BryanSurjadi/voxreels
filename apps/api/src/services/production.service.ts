import OpenAI from "openai";
import { env } from "../config/env.js";
import { AppError } from "../middlewares/error.middleware.js";
import * as productionRepository from "../repositories/production.repository.js";
import type { BrollGenerationInput, VoiceGenerationInput } from "../schemas/production.schema.js";
import { readMedia, storeMedia } from "../utils/media-storage.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 120_000 });

async function approvedProject(workspaceId: string, projectId: string) {
  const project = await productionRepository.findApprovedProject(workspaceId, projectId);
  if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  if (!project.scriptVersions[0]) throw new AppError(409, "SCRIPT_NOT_APPROVED", "Approve the script before generating assets");
  return { project, script: project.scriptVersions[0] };
}

export async function generateVoice(workspaceId: string, projectId: string, input: VoiceGenerationInput) {
  if (!env.ELEVENLABS_API_KEY) throw new AppError(503, "ELEVENLABS_NOT_CONFIGURED", "Add ELEVENLABS_API_KEY to generate voiceovers");
  const voiceId = input.voiceId ?? (input.gender === "male" ? env.ELEVENLABS_MALE_VOICE_ID : env.ELEVENLABS_FEMALE_VOICE_ID) ?? env.ELEVENLABS_DEFAULT_VOICE_ID;
  if (!voiceId) throw new AppError(400, "VOICE_REQUIRED", "Choose a voice or configure ELEVENLABS_DEFAULT_VOICE_ID");
  const { script } = await approvedProject(workspaceId, projectId);
  await productionRepository.setProjectStatus(workspaceId, projectId, "generating_assets");

  try {
    for (const beat of script.beats) {
      if (beat.voiceTakes.some((take) => take.model === input.model && take.voiceId === voiceId)) continue;
      const take = await productionRepository.createVoiceTake(beat.id, input.model, voiceId, beat.voiceover.length);
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": env.ELEVENLABS_API_KEY },
          body: JSON.stringify({ text: beat.voiceover, model_id: input.model }),
        });
        if (!response.ok) throw new Error(`ElevenLabs returned ${response.status}`);
        const storageKey = await storeMedia(Buffer.from(await response.arrayBuffer()), "mp3");
        await productionRepository.completeVoiceTake(take.id, storageKey, response.headers.get("request-id"));
        await productionRepository.attachVoiceToTimelines(beat.id, take.id);
      } catch (error) {
        await productionRepository.failVoiceTake(take.id, error instanceof Error ? error.message : "Voice generation failed");
        throw error;
      }
    }
    await productionRepository.setProjectStatus(workspaceId, projectId, "asset_review");
    return approvedProject(workspaceId, projectId).then(({ script: next }) => next.beats);
  } catch {
    await productionRepository.setProjectStatus(workspaceId, projectId, "script_approved");
    throw new AppError(502, "VOICE_GENERATION_FAILED", "Voice generation failed. Check the ElevenLabs key, voice ID, and account credits");
  }
}

export async function generateBroll(workspaceId: string, projectId: string, input: BrollGenerationInput) {
  const { project, script } = await approvedProject(workspaceId, projectId);
  if (input.beatIds.some((beatId) => !script.beats.some((beat) => beat.id === beatId))) {
    throw new AppError(400, "INVALID_SCRIPT_BEAT", "One or more selected beats do not belong to the approved script");
  }
  const selectedBeatIds = new Set(input.beatIds);
  await productionRepository.setProjectStatus(workspaceId, projectId, "generating_assets");
  try {
    for (const beat of script.beats) {
      if (!selectedBeatIds.has(beat.id)) continue;
      if (beat.truthRequirement === "real_footage_required") continue;
      if (beat.mediaLinks.some((link) => link.mediaAsset.status === "ready" && link.mediaAsset.provider === "openai")) continue;
      const asset = await productionRepository.createPendingBroll(workspaceId, projectId, beat.id, `${beat.role ?? "Beat"} B-roll`, input.model);
      const prompt = `Create one vertical 9:16 photographic B-roll still for a short social video. Brand: ${project.brand.name}. Topic: ${project.topic ?? project.name}. Shot direction: ${beat.visualRequirement || beat.voiceover}. No text, logos, watermarks, fabricated testimonials, or before-and-after claims.`;
      try {
        const response = await openai.images.generate({ model: input.model, prompt, size: "1024x1536", quality: "low", output_format: "png" });
        const encoded = response.data?.[0]?.b64_json;
        if (!encoded) throw new Error("OpenAI returned no image");
        const storageKey = await storeMedia(Buffer.from(encoded, "base64"), "png");
        await productionRepository.completeBroll(asset.id, beat.id, storageKey, prompt);
        await productionRepository.attachMediaToTimelines(beat.id, asset.id);
      } catch (error) {
        await productionRepository.failBroll(asset.id, error instanceof Error ? error.message : "B-roll generation failed");
        throw error;
      }
    }
    await productionRepository.setProjectStatus(workspaceId, projectId, "asset_review");
    return approvedProject(workspaceId, projectId).then(({ script: next }) => next.beats);
  } catch {
    await productionRepository.setProjectStatus(workspaceId, projectId, "script_approved");
    throw new AppError(502, "BROLL_GENERATION_FAILED", "B-roll generation failed. Check the OpenAI account credits and image access");
  }
}

export async function initializeTimeline(workspaceId: string, projectId: string) {
  const { project, script } = await approvedProject(workspaceId, projectId);
  const totalDuration = (project.targetDurationSeconds ?? 30) * 1000;
  const totalCharacters = script.beats.reduce((sum, beat) => sum + beat.voiceover.length, 0) || 1;
  let startMs = 0;
  const items = script.beats.flatMap((beat, index) => {
    // ponytail: proportional timing is enough for MVP; replace with probed audio durations when rendering MP4.
    const durationMs = index === script.beats.length - 1 ? totalDuration - startMs : Math.round(totalDuration * beat.voiceover.length / totalCharacters);
    const common = { scriptBeatId: beat.id, order: index, startMs, durationMs };
    const voice = beat.voiceTakes[0];
    const visual = beat.mediaLinks.find((link) => link.mediaAsset.status === "ready")?.mediaAsset;
    const beatItems = [
      { ...common, trackType: "voice", trackIndex: 0, ...(voice && { voiceTakeId: voice.id }) },
      { ...common, trackType: "visual", trackIndex: 1, ...(visual && { mediaAssetId: visual.id }) },
      { ...common, trackType: "text", trackIndex: 2, text: beat.onScreenText ?? "" },
    ];
    startMs += durationMs;
    return beatItems;
  });
  const timeline = await productionRepository.createTimeline(projectId, script.id, `${project.name} edit`, totalDuration, items);
  await productionRepository.setProjectStatus(workspaceId, projectId, "editing");
  return timeline;
}

export async function updateTimeline(workspaceId: string, projectId: string, timelineId: string, items: Array<{ id: string; startMs: number; durationMs: number }>) {
  const timeline = await productionRepository.updateTimeline(workspaceId, projectId, timelineId, items);
  if (!timeline) throw new AppError(404, "TIMELINE_NOT_FOUND", "Timeline not found");
  return timeline;
}

const mediaExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export async function uploadMedia(workspaceId: string, projectId: string, file: Buffer, fileName: string, mimeType: string) {
  await approvedProject(workspaceId, projectId);
  const extension = mediaExtensions[mimeType];
  if (!extension || !file.length) throw new AppError(400, "UNSUPPORTED_MEDIA", "Upload a JPG, PNG, WebP, MP4, WebM, MP3, or WAV file");
  const kind = mimeType.split("/")[0]!;
  const storageKey = await storeMedia(file, extension);
  return productionRepository.createUploadedMedia(workspaceId, projectId, fileName.slice(0, 160) || `Uploaded ${kind}`, kind, mimeType, storageKey);
}

export async function addTimelineItem(workspaceId: string, projectId: string, timelineId: string, input: { mediaAssetId: string; trackType: "visual" | "audio"; startMs: number; durationMs: number }) {
  const item = await productionRepository.addMediaToTimeline(workspaceId, projectId, timelineId, input);
  if (!item) throw new AppError(404, "MEDIA_OR_TIMELINE_NOT_FOUND", "The media or timeline could not be found");
  return item;
}

export async function exportProject(workspaceId: string, projectId: string) {
  const { project, script } = await approvedProject(workspaceId, projectId);
  const timeline = project.timelines[0];
  const manifest = {
    format: "voxreels-project-v1",
    exportedAt: new Date().toISOString(),
    project: { id: project.id, name: project.name, topic: project.topic, brand: project.brand.name },
    script: {
      id: script.id,
      version: script.version,
      content: script.content,
      beats: script.beats.map((beat) => ({
        id: beat.id,
        order: beat.order,
        role: beat.role,
        voiceover: beat.voiceover,
        delivery: beat.delivery,
        onScreenText: beat.onScreenText,
        visualRequirement: beat.visualRequirement,
        truthRequirement: beat.truthRequirement,
        voiceovers: beat.voiceTakes.map((take) => ({ id: take.id, model: take.model, voiceId: take.voiceId, downloadPath: `/projects/${projectId}/voice/${take.id}` })),
        broll: beat.mediaLinks.filter((link) => link.mediaAsset.status === "ready").map((link) => ({ id: link.mediaAsset.id, mimeType: link.mediaAsset.mimeType, downloadPath: `/projects/${projectId}/broll/${link.mediaAsset.id}` })),
      })),
    },
    timeline,
  };
  const record = await productionRepository.createExport(projectId, timeline?.id, manifest);
  return { export: record, manifest };
}

export async function getMedia(workspaceId: string, projectId: string, mediaId: string, kind: "voice" | "broll") {
  const voice = kind === "voice" ? await productionRepository.findVoiceMedia(workspaceId, projectId, mediaId) : null;
  const broll = kind === "broll" ? await productionRepository.findBrollMedia(workspaceId, projectId, mediaId) : null;
  const storageKey = voice?.storageKey ?? broll?.storageKey;
  if (!storageKey) throw new AppError(404, "MEDIA_NOT_FOUND", "Media file not found");
  try {
    return { data: await readMedia(storageKey), mimeType: voice ? "audio/mpeg" : broll?.mimeType ?? "application/octet-stream" };
  } catch {
    throw new AppError(404, "MEDIA_NOT_FOUND", "Media file not found");
  }
}
