import { z } from "zod";

export const SUPPORTED_SCRIPT_MODELS = [
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5.5",
] as const;

export const generateScriptSchema = z.object({
  model: z.enum(SUPPORTED_SCRIPT_MODELS).default("gpt-5.6-terra"),
});

export const scriptVersionParamsSchema = z.object({
  projectId: z.uuid(),
  scriptVersionId: z.uuid(),
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
