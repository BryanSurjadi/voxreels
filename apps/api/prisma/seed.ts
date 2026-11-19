import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });
const referenceSchema = z.array(z.object({
  sourceUrl: z.string().url(),
  platform: z.string().min(1),
  creator: z.string().min(1).optional(),
  title: z.string().min(1),
  language: z.string().min(2),
  niche: z.string().min(1).optional(),
  durationSeconds: z.number().int().positive().optional(),
  hookExcerpt: z.string().max(240).optional(),
  transcriptSummary: z.string().min(1),
  hookPattern: z.string().min(1),
  structureSummary: z.string().min(1),
  ctaStyle: z.string().min(1).optional(),
  whyItWorked: z.string().min(1),
  metrics: z.record(z.string(), z.number()).optional(),
  capturedAt: z.string().datetime().optional(),
  rightsStatus: z.string().default("derived_reference"),
}));

function referenceEmbeddingText(reference: z.infer<typeof referenceSchema>[number]) {
  return [reference.language, reference.niche, reference.hookPattern, reference.structureSummary, reference.ctaStyle, reference.transcriptSummary].filter(Boolean).join("\n");
}

async function seedReferences() {
  const references = referenceSchema.parse(JSON.parse(await readFile(new URL("./reference-scripts.json", import.meta.url), "utf8")));
  if (!references.length) return 0;
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to seed reference embeddings");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const texts = references.map(referenceEmbeddingText);
  const model = "text-embedding-3-small";
  console.log("[rag:seed] Requesting reference embeddings", { model, references: texts.length });
  const response = await openai.embeddings.create({ model, input: texts, encoding_format: "float" });

  await prisma.$transaction(references.map((reference, index) => prisma.referenceScript.upsert({
    where: { sourceUrl: reference.sourceUrl },
    update: { ...reference, capturedAt: reference.capturedAt ? new Date(reference.capturedAt) : null, embeddingText: texts[index], embedding: response.data[index].embedding },
    create: { ...reference, capturedAt: reference.capturedAt ? new Date(reference.capturedAt) : null, embeddingText: texts[index], embedding: response.data[index].embedding },
  })));
  return references.length;
}

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: {
      slug: "bryan",
    },
    update: {
      name: "Bryan's Workspace",
    },
    create: {
      name: "Bryan's Workspace",
      slug: "bryan",
    },
  });

  const brands = await Promise.all([
    prisma.brand.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: "salon-murah-jakarta",
        },
      },
      update: {
        name: "Salon Murah Jakarta",
      },
      create: {
        workspaceId: workspace.id,
        name: "Salon Murah Jakarta",
        slug: "salon-murah-jakarta",
      },
    }),

    prisma.brand.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: "coe-studio",
        },
      },
      update: {
        name: "COE Studio",
      },
      create: {
        workspaceId: workspace.id,
        name: "COE Studio",
        slug: "coe-studio",
      },
    }),
  ]);
  const referenceCount = await seedReferences();

  console.log("Seed complete");
  console.log({
    workspace: workspace.name,
    brands: brands.map((brand) => brand.name),
    referenceScripts: referenceCount,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
