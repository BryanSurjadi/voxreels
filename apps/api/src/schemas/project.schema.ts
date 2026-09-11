import { z } from "zod";

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const projectIdParamsSchema = z.object({
  projectId: z.uuid(),
});

export const createProjectSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  name: optionalText(120),
  brandId: z.uuid().optional(),
  goal: optionalText(200),
  offer: optionalText(200),
  callToAction: optionalText(200),
  targetDurationSeconds: z.number().int().min(5).max(180).optional(),
});

export const updateProjectSchema = createProjectSchema
  .omit({ topic: true })
  .extend({
    topic: optionalText(500),
    status: z.enum([
      "draft",
      "generating_script",
      "script_review",
      "generating_assets",
      "asset_review",
      "editing",
      "exporting",
      "completed",
    ]).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required",
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
