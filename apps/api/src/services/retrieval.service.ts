import OpenAI from "openai";
import { env } from "../config/env.js";
import * as referenceRepository from "../repositories/reference.repository.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000 });

export function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftLength = 0;
  let rightLength = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;
    dot += leftValue * rightValue;
    leftLength += leftValue ** 2;
    rightLength += rightValue ** 2;
  }
  return leftLength && rightLength ? dot / Math.sqrt(leftLength * rightLength) : 0;
}

export async function retrieveCreativeReferences(query: string, limit = 4) {
  const references = await referenceRepository.findAll();
  const debug = env.NODE_ENV === "development";
  if (!references.length) {
    if (debug) console.log("[rag] No references in the database. Skipping query embedding.");
    return { references: [], inputTokens: 0 };
  }

  const model = "text-embedding-3-small";
  const input = query.replaceAll("\n", " ");
  if (debug) console.log("[rag] Requesting query embedding", { model, queryCharacters: input.length, availableReferences: references.length });
  const response = await openai.embeddings.create({
    model,
    input,
    encoding_format: "float",
  });
  const queryEmbedding = response.data[0]?.embedding;
  if (!queryEmbedding) throw new Error("OpenAI returned no query embedding");

  // ponytail: exact scan is simpler and fast for a curated corpus; move to pgvector after thousands of references.
  const ranked = references
    .map((reference) => ({ ...reference, similarityScore: cosineSimilarity(queryEmbedding, reference.embedding) }))
    .sort((left, right) => right.similarityScore - left.similarityScore);
  // ponytail: heuristic cutoff for a tiny corpus; tune with labeled examples when the corpus grows.
  const minimumSimilarity = 0.35;
  const matches = ranked
    .filter((reference) => reference.similarityScore >= minimumSimilarity)
    .slice(0, limit)
    .map(({ embedding: _embedding, ...reference }, retrievalRank) => ({ ...reference, retrievalRank: retrievalRank + 1 }));
  const inputTokens = response.usage?.total_tokens ?? 0;
  if (debug) {
    console.log("[rag] Retrieval complete", {
      minimumSimilarity,
      bestScore: ranked[0]?.similarityScore,
      inputTokens,
      matchCount: matches.length,
      matches: matches.map(({ title, sourceUrl, similarityScore }) => ({ title, sourceUrl, similarityScore })),
    });
  }
  return { references: matches, inputTokens };
}
