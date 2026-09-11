import { z } from "zod";

export const SUPPORTED_SCRIPT_MODELS = ["gpt-5.6-sol", "gpt-5.5"] as const;

export const generateScriptSchema = z.object({
  model: z.enum(SUPPORTED_SCRIPT_MODELS).default("gpt-5.6-sol"),
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
