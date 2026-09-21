import OpenAI from "openai";
import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { env } from "../config/env.js";
import { AppError } from "../middlewares/error.middleware.js";
import * as productionRepository from "../repositories/production.repository.js";
import type { BrollGenerationInput, VoiceGenerationInput } from "../schemas/production.schema.js";
import { mediaPath, readMedia, reserveMediaPath, storeMedia } from "../utils/media-storage.js";
import { reserveGenerationCredits, settleGenerationCredits } from "./ai-quota.service.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 120_000 });
const ffmpegPath = createRequire(import.meta.url)("ffmpeg-static") as string | null;

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
  const { project, script } = await approvedProject(workspaceId, projectId);
  const missing = script.beats.filter((beat) => !beat.voiceTakes.some((take) => take.model === input.model && take.voiceId === voiceId));
  if (!missing.length) return script.beats;
  const locked = await productionRepository.beginAssetGeneration(workspaceId, projectId);
  if (locked.count !== 1) throw new AppError(409, "PROJECT_BUSY", "This project is already generating content");

  let credit: Awaited<ReturnType<typeof reserveGenerationCredits>> | null = null;
  let generated = 0;
  try {
    credit = await reserveGenerationCredits(workspaceId, 1);
    for (const beat of missing) {
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
        generated += 1;
        await productionRepository.attachVoiceToTimelines(beat.id, take.id);
      } catch (error) {
        await productionRepository.failVoiceTake(take.id, error instanceof Error ? error.message : "Voice generation failed");
        throw error;
      }
    }
    await productionRepository.setProjectStatus(workspaceId, projectId, "asset_review");
    return approvedProject(workspaceId, projectId).then(({ script: next }) => next.beats);
  } catch (error) {
    await productionRepository.setProjectStatus(workspaceId, projectId, project.status);
    if (error instanceof AppError) throw error;
    throw new AppError(502, "VOICE_GENERATION_FAILED", "Voice generation failed. Check the ElevenLabs key, voice ID, and account credits");
  } finally {
    if (credit) await settleGenerationCredits(credit, generated > 0 ? 1 : 0);
  }
}

export async function generateBroll(workspaceId: string, projectId: string, input: BrollGenerationInput) {
  const { project, script } = await approvedProject(workspaceId, projectId);
  if (input.beatIds.some((beatId) => !script.beats.some((beat) => beat.id === beatId))) {
    throw new AppError(400, "INVALID_SCRIPT_BEAT", "One or more selected beats do not belong to the approved script");
  }
  const selectedBeatIds = new Set(input.beatIds);
  const targets = script.beats.filter((beat) => selectedBeatIds.has(beat.id) && beat.truthRequirement !== "real_footage_required" && !beat.mediaLinks.some((link) => link.mediaAsset.status === "ready" && link.mediaAsset.provider === "openai"));
  if (!targets.length) return script.beats;
  const locked = await productionRepository.beginAssetGeneration(workspaceId, projectId);
  if (locked.count !== 1) throw new AppError(409, "PROJECT_BUSY", "This project is already generating content");
  let credit: Awaited<ReturnType<typeof reserveGenerationCredits>> | null = null;
  let generated = 0;
  try {
    credit = await reserveGenerationCredits(workspaceId, targets.length);
    for (const beat of targets) {
      const asset = await productionRepository.createPendingBroll(workspaceId, projectId, beat.id, `${beat.role ?? "Beat"} B-roll`, input.model);
      const prompt = `Create one vertical 9:16 photographic B-roll still for a short social video. Brand: ${project.brand.name}. Topic: ${project.topic ?? project.name}. Shot direction: ${beat.visualRequirement || beat.voiceover}. No text, logos, watermarks, fabricated testimonials, or before-and-after claims.`;
      try {
        const response = await openai.images.generate({ model: input.model, prompt, size: "1024x1536", quality: "low", output_format: "png" });
        const encoded = response.data?.[0]?.b64_json;
        if (!encoded) throw new Error("OpenAI returned no image");
        const storageKey = await storeMedia(Buffer.from(encoded, "base64"), "png");
        await productionRepository.completeBroll(asset.id, beat.id, storageKey, prompt);
        generated += 1;
        await productionRepository.attachMediaToTimelines(beat.id, asset.id);
      } catch (error) {
        await productionRepository.failBroll(asset.id, error instanceof Error ? error.message : "B-roll generation failed");
        throw error;
      }
    }
    await productionRepository.setProjectStatus(workspaceId, projectId, "asset_review");
    return approvedProject(workspaceId, projectId).then(({ script: next }) => next.beats);
  } catch (error) {
    await productionRepository.setProjectStatus(workspaceId, projectId, project.status);
    if (error instanceof AppError) throw error;
    throw new AppError(502, "BROLL_GENERATION_FAILED", "B-roll generation failed. Check the OpenAI account credits and image access");
  } finally {
    if (credit) await settleGenerationCredits(credit, generated);
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

export async function updateTimeline(workspaceId: string, projectId: string, timelineId: string, items: Array<{ id: string; startMs: number; durationMs: number; trimStartMs: number; text: string | null }>) {
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

export async function addTimelineItem(workspaceId: string, projectId: string, timelineId: string, input: { mediaAssetId: string; trackType: "visual" | "audio"; startMs: number; durationMs: number } | { trackType: "text"; text: string; startMs: number; durationMs: number }) {
  const item = await productionRepository.addMediaToTimeline(workspaceId, projectId, timelineId, input);
  if (!item) throw new AppError(404, "MEDIA_OR_TIMELINE_NOT_FOUND", "The media or timeline could not be found");
  return item;
}

export async function splitTimelineItem(workspaceId: string, projectId: string, timelineId: string, itemId: string, atMs: number) {
  const item = await productionRepository.splitTimelineItem(workspaceId, projectId, timelineId, itemId, atMs);
  if (!item) throw new AppError(400, "INVALID_SPLIT", "Move the playhead inside the selected clip before splitting");
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

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "voxreels";
}

function subtitleTime(milliseconds: number) {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  const seconds = Math.floor(milliseconds % 60_000 / 1000);
  const millis = Math.floor(milliseconds % 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function ffmpegFilterPath(path: string) {
  return path.replaceAll("\\", "/").replace(":", "\\:").replaceAll("'", "\\'");
}

export async function assetBundle(workspaceId: string, projectId: string) {
  const { project, script } = await approvedProject(workspaceId, projectId);
  const files: Array<{ name: string; data: Buffer }> = [
    {
      name: "script.json",
      data: Buffer.from(JSON.stringify({ title: project.name, content: script.content, beats: script.beats.map(({ order, role, voiceover, delivery, onScreenText, visualRequirement, truthRequirement }) => ({ order, role, voiceover, delivery, onScreenText, visualRequirement, truthRequirement })) }, null, 2)),
    },
    { name: "script.txt", data: Buffer.from(script.content) },
  ];

  for (const beat of script.beats) {
    const prefix = `${String(beat.order + 1).padStart(2, "0")}-${safeFileName(beat.role ?? "beat")}`;
    const voice = beat.voiceTakes.find((take) => take.storageKey);
    if (voice?.storageKey) files.push({ name: `voice/${prefix}.mp3`, data: await readMedia(voice.storageKey) });
    const visual = beat.mediaLinks.find((link) => link.mediaAsset.status === "ready" && link.mediaAsset.storageKey)?.mediaAsset;
    if (visual?.storageKey) files.push({ name: `broll/${prefix}.${visual.mimeType === "image/jpeg" ? "jpg" : "png"}`, data: await readMedia(visual.storageKey) });
  }

  return { fileName: `${safeFileName(project.name)}-assets.zip`, files };
}

function runFfmpeg(args: string[]) {
  if (!ffmpegPath) throw new AppError(503, "VIDEO_RENDERER_UNAVAILABLE", "The video renderer is unavailable");
  return new Promise<void>((resolve, reject) => {
    const process = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    process.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-5000); });
    process.on("error", reject);
    process.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg exited with code ${code}`)));
  });
}

export async function renderVideo(workspaceId: string, projectId: string) {
  const timeline = await productionRepository.findTimelineForRender(workspaceId, projectId);
  if (!timeline) throw new AppError(409, "TIMELINE_REQUIRED", "Create and save the timeline before exporting video");

  const durationSeconds = Math.max((timeline.durationMs ?? 1000) / 1000, 1);
  const args = ["-y", "-f", "lavfi", "-i", `color=c=black:s=${timeline.canvasWidth}x${timeline.canvasHeight}:r=${timeline.framesPerSecond}:d=${durationSeconds}`];
  const visuals: Array<{ input: number; start: number; end: number }> = [];
  const audios: Array<{ input: number; startMs: number; duration: number; volume: number }> = [];
  let input = 1;

  for (const item of timeline.items) {
    const storageKey = item.mediaAsset?.storageKey ?? item.voiceTake?.storageKey;
    if (!storageKey) continue;
    const duration = Math.max(item.durationMs / 1000, 0.1);
    if (item.trackType === "visual" && item.mediaAsset) {
      if (item.mediaAsset.kind === "image") args.push("-loop", "1", "-t", String(duration), "-i", mediaPath(storageKey));
      else if (item.mediaAsset.kind === "video") args.push("-stream_loop", "-1", "-ss", String(item.trimStartMs / 1000), "-t", String(duration), "-i", mediaPath(storageKey));
      else continue;
      visuals.push({ input, start: item.startMs / 1000, end: (item.startMs + item.durationMs) / 1000 });
      input += 1;
    } else if (item.trackType === "voice" || item.trackType === "audio") {
      args.push("-ss", String(item.trimStartMs / 1000), "-i", mediaPath(storageKey));
      audios.push({ input, startMs: item.startMs, duration, volume: item.volume });
      input += 1;
    }
  }

  const filters = ["[0:v]format=yuv420p[base0]"];
  visuals.forEach((visual, index) => {
    filters.push(`[${visual.input}:v]scale=${timeline.canvasWidth}:${timeline.canvasHeight}:force_original_aspect_ratio=decrease,pad=${timeline.canvasWidth}:${timeline.canvasHeight}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,setpts=PTS-STARTPTS+${visual.start}/TB[v${index}]`);
    filters.push(`[base${index}][v${index}]overlay=eof_action=pass:enable='between(t,${visual.start},${visual.end})'[base${index + 1}]`);
  });
  audios.forEach((audio, index) => filters.push(`[${audio.input}:a]apad,atrim=0:${audio.duration},asetpts=PTS-STARTPTS,adelay=${audio.startMs}:all=1,volume=${audio.volume}[a${index}]`));
  if (audios.length) filters.push(`${audios.map((_, index) => `[a${index}]`).join("")}amix=inputs=${audios.length}:duration=longest:normalize=0,atrim=0:${durationSeconds}[audio]`);

  const captions = timeline.items.filter((item) => item.trackType === "text" && item.text?.trim());
  const captionFile = captions.length ? await reserveMediaPath("srt") : null;
  let videoOutput = `base${visuals.length}`;
  if (captionFile) {
    const contents = captions.map((item, index) => `${index + 1}\n${subtitleTime(item.startMs)} --> ${subtitleTime(item.startMs + item.durationMs)}\n${item.text!.replace(/\r?\n/g, " ")}\n`).join("\n");
    await writeFile(captionFile.path, contents);
    filters.push(`[${videoOutput}]subtitles=filename='${ffmpegFilterPath(captionFile.path)}':force_style='Alignment=2,FontSize=26,PrimaryColour=&H00FFFFFF,Outline=2,MarginV=110'[captioned]`);
    videoOutput = "captioned";
  }

  const output = await reserveMediaPath("mp4");
  const record = await productionRepository.createPendingVideoExport(projectId, timeline.id);
  try {
    args.push("-filter_complex", filters.join(";"), "-map", `[${videoOutput}]`);
    if (audios.length) args.push("-map", "[audio]", "-c:a", "aac", "-b:a", "192k");
    else args.push("-an");
    args.push("-t", String(durationSeconds), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output.path);
    await runFfmpeg(args);
    await productionRepository.completeVideoExport(record.id, output.storageKey, { width: timeline.canvasWidth, height: timeline.canvasHeight, durationMs: timeline.durationMs });
    await productionRepository.setProjectStatus(workspaceId, projectId, "complete");
    return { id: record.id, downloadPath: `/projects/${projectId}/exports/${record.id}` };
  } catch (error) {
    await rm(output.path, { force: true });
    await productionRepository.failVideoExport(record.id, error instanceof Error ? error.message : "Video rendering failed");
    throw new AppError(502, "VIDEO_RENDER_FAILED", "Video rendering failed. Check that the timeline media is still available");
  } finally {
    if (captionFile) await rm(captionFile.path, { force: true });
  }
}

export async function getExportMedia(workspaceId: string, projectId: string, exportId: string) {
  const record = await productionRepository.findExport(workspaceId, projectId, exportId);
  if (!record?.storageKey) throw new AppError(404, "EXPORT_NOT_FOUND", "Video export not found");
  return { data: await readMedia(record.storageKey), mimeType: "video/mp4" };
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
