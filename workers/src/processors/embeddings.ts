import type { Job } from "bullmq";
import { indexDocumentText } from "../../../lib/ai/rag";
import { prisma } from "../../../lib/db/prisma";

export async function processEmbeddingJob(
  job: Job<{ documentId: string; text?: string }>,
) {
  const { documentId, text } = job.data;
  let content = text;
  if (!content) {
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: "asc" },
    });
    content = chunks.map((c) => c.content).join("\n\n");
  }
  if (!content) {
    throw new Error("No text available for embedding");
  }
  const result = await indexDocumentText({ documentId, text: content });
  await job.updateProgress(100);
  return result;
}

export async function processDocumentJob(
  job: Job<{ documentId: string; text: string }>,
) {
  return processEmbeddingJob(job);
}
