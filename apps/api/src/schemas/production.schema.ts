import { z } from "zod";

export const voiceGenerationSchema = z.object({
  voiceId: z.string().trim().min(1).max(100).optional(),
  beatIds: z.array(z.uuid()).min(1).max(12).optional(),
  gender: z.enum(["male", "female"]).default("female"),
  model: z.enum(["eleven_flash_v2_5", "eleven_multilingual_v2"]).default("eleven_flash_v2_5"),
});

export const brollGenerationSchema = z.object({
  beatIds: z.array(z.uuid()).min(1).max(12),
  model: z.literal("gpt-image-2.5-flare").default("gpt-image-2.5-flare"),
});

export const mediaParamsSchema = z.object({
  projectId: z.uuid(),
  mediaId: z.uuid(),
});

export const timelineParamsSchema = z.object({
  projectId: z.uuid(),
  timelineId: z.uuid(),
});

export const exportParamsSchema = z.object({
  projectId: z.uuid(),
  exportId: z.uuid(),
});

export const updateTimelineSchema = z.object({
  items: z.array(z.object({
    id: z.uuid(),
    startMs: z.number().int().min(0),
    durationMs: z.number().int().min(100),
    trimStartMs: z.number().int().min(0),
    text: z.string().max(1000).nullable(),
  })).max(100),
});

export const addTimelineItemSchema = z.union([z.object({
  mediaAssetId: z.uuid(),
  trackType: z.enum(["visual", "audio"]),
  startMs: z.number().int().min(0),
  durationMs: z.number().int().min(100),
}), z.object({
  trackType: z.literal("text"),
  text: z.string().trim().min(1).max(1000),
  startMs: z.number().int().min(0),
  durationMs: z.number().int().min(100),
})]);

export const splitTimelineItemSchema = z.object({
  atMs: z.number().int().min(0),
});

export type VoiceGenerationInput = z.infer<typeof voiceGenerationSchema>;
export type BrollGenerationInput = z.infer<typeof brollGenerationSchema>;
