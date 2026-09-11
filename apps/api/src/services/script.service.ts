import OpenAI from "openai";
import { env } from "../config/env.js";
import { AppError } from "../middlewares/error.middleware.js";
import * as scriptRepository from "../repositories/script.repository.js";
import {
  generatedScriptSchema,
  type GenerateScriptInput,
} from "../schemas/script.schema.js";

const DAILY_SCRIPT_LIMIT = 10;
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 60_000 });

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "beats"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 120 },
    beats: {
      type: "array",
      minItems: 3,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "role",
          "voiceover",
          "delivery",
          "onScreenText",
          "visualRequirement",
          "truthRequirement",
        ],
        properties: {
          role: { type: "string", enum: ["hook", "context", "value", "proof", "cta"] },
          voiceover: { type: "string", minLength: 1 },
          delivery: { type: "string" },
          onScreenText: { type: "string" },
          visualRequirement: { type: "string" },
          truthRequirement: {
            type: "string",
            enum: [
              "real_footage_required",
              "real_footage_preferred",
              "generated_visual_allowed",
            ],
          },
        },
      },
    },
  },
} as const;

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function generateScript(
  workspaceId: string,
  projectId: string,
  userId: string,
  input: GenerateScriptInput,
) {
  const project = await scriptRepository.findProject(workspaceId, projectId);
  if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  if (!project.topic) throw new AppError(400, "TOPIC_REQUIRED", "Project topic is required");

  const generatedToday = await scriptRepository.countGeneratedSince(userId, startOfUtcDay());
  if (generatedToday >= DAILY_SCRIPT_LIMIT) {
    throw new AppError(429, "DAILY_SCRIPT_LIMIT", "Daily script generation limit reached");
  }

  const locked = await scriptRepository.beginGeneration(workspaceId, projectId);
  if (locked.count !== 1) {
    throw new AppError(409, "PROJECT_BUSY", "This project is already generating content");
  }

  try {
    const response = await openai.responses.create({
      model: input.model,
      instructions:
        "Create a concise vertical-video script. Use a strong hook, a coherent beat progression, concrete visual directions, and one clear CTA. Never invent testimonials, results, credentials, prices, or before-and-after claims. Mark claims needing authentic evidence as real footage required or preferred.",
      input: JSON.stringify({
        brand: project.brand.name,
        topic: project.topic,
        goal: project.goal,
        offer: project.offer,
        callToAction: project.callToAction,
        targetDurationSeconds: project.targetDurationSeconds ?? 30,
      }),
      reasoning: { effort: "medium" },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "reel_script",
          strict: true,
          schema: outputSchema,
        },
      },
      max_output_tokens: 8_000,
      store: false,
    });

    if (!response.output_text) {
      throw new Error("OpenAI returned no script output");
    }

    const script = generatedScriptSchema.parse(JSON.parse(response.output_text));
    return await scriptRepository.saveGeneratedScript({
      workspaceId,
      projectId,
      userId,
      model: input.model,
      providerResponseId: response.id,
      ...(response.usage?.input_tokens !== undefined && {
        inputTokens: response.usage.input_tokens,
      }),
      ...(response.usage?.output_tokens !== undefined && {
        outputTokens: response.usage.output_tokens,
      }),
      ...(response.usage?.total_tokens !== undefined && {
        totalTokens: response.usage.total_tokens,
      }),
      script,
    });
  } catch (error) {
    await scriptRepository.restoreProjectStatus(workspaceId, projectId, project.status);
    if (error instanceof AppError) throw error;
    throw new AppError(502, "SCRIPT_GENERATION_FAILED", "Script generation failed");
  }
}
