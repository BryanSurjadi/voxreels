import { z } from "zod";

export const brandIdParamsSchema = z.object({
  brandId: z.uuid(),
});

export const createBrandSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const updateBrandSchema = createBrandSchema;

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
