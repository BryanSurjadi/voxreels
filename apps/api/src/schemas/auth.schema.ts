import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "Password must be no more than 72 UTF-8 bytes",
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
});

export const registrationSchema = loginSchema.extend({
  displayName: z.string().trim().min(2).max(80),
});

export const switchWorkspaceSchema = z.object({
  workspaceId: z.uuid(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
