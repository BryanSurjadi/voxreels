import { z } from "zod";

export const SUPPORTED_SCRIPT_MODELS = [
  "gpt-6.1-sol",
  "gpt-6.1-terra",
  "gpt-6-luna",
] as const;

const scriptModelSchema = z.enum(SUPPORTED_SCRIPT_MODELS).default(SUPPORTED_SCRIPT_MODELS[0]);

export const generateScriptSchema = z.object({
  model: scriptModelSchema,
});

export const scriptVersionParamsSchema = z.object({
  projectId: z.uuid(),
  scriptVersionId: z.uuid(),
});

export const refineBeatParamsSchema = scriptVersionParamsSchema.extend({ beatId: z.uuid() });

export const refineBeatSchema = z.object({
  instruction: z.string().trim().min(3).max(500),
  model: scriptModelSchema,
});

export const refinedBeatSchema = z.object({
  voiceover: z.string().trim().min(1).max(2_000),
  delivery: z.string().trim().max(500),
  onScreenText: z.string().trim().max(500),
  visualRequirement: z.string().trim().max(1_000),
  truthRequirement: z.enum([
    "real_footage_required",
    "real_footage_preferred",
    "generated_visual_allowed",
  ]),
});

export const updateScriptSchema = z.object({
  beats: z.array(z.object({
    id: z.uuid(),
    voiceover: z.string().trim().min(1).max(2_000),
    delivery: z.string().trim().max(500),
    onScreenText: z.string().trim().max(500),
    visualRequirement: z.string().trim().max(1_000),
    truthRequirement: z.enum([
      "real_footage_required",
      "real_footage_preferred",
      "generated_visual_allowed",
    ]),
  })).min(1).max(12),
});

export const generatedScriptSchema = z.object({
  title: z.string().trim().min(1).max(120),
  beats: z
    .array(
      z.object({
        role: z.enum(["hook", "context", "value", "proof", "cta"]),
        voiceover: z.string().trim().min(1),
        delivery: z.string().trim(),
        onScreenText: z.string().trim(),
        visualRequirement: z.string().trim(),
        truthRequirement: z.enum([
          "real_footage_required",
          "real_footage_preferred",
          "generated_visual_allowed",
        ]),
      }),
    )
    .min(3)
    .max(12),
});

export type GenerateScriptInput = z.infer<typeof generateScriptSchema>;
export type GeneratedScript = z.infer<typeof generatedScriptSchema>;
export type UpdateScriptInput = z.infer<typeof updateScriptSchema>;
export type RefineBeatInput = z.infer<typeof refineBeatSchema>;
