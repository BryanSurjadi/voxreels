import { prisma } from "../config/prisma.js";

export function findAll() {
  return prisma.referenceScript.findMany({
    select: {
      id: true,
      sourceUrl: true,
      platform: true,
      creator: true,
      title: true,
      language: true,
      niche: true,
      hookExcerpt: true,
      transcriptSummary: true,
      hookPattern: true,
      structureSummary: true,
      ctaStyle: true,
      whyItWorked: true,
      embedding: true,
    },
  });
}
