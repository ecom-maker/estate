import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 120,
): Promise<string[]> {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export async function indexDocumentText(params: {
  documentId: string;
  text: string;
}) {
  const chunks = await chunkText(params.text);
  await prisma.documentChunk.deleteMany({
    where: { documentId: params.documentId },
  });

  for (const [index, content] of chunks.entries()) {
    await prisma.documentChunk.create({
      data: {
        documentId: params.documentId,
        content,
        chunkIndex: index,
        tokenCount: Math.ceil(content.length / 4),
      },
    });
  }

  await prisma.knowledgeDocument.update({
    where: { id: params.documentId },
    data: { status: "indexed" },
  });

  return { chunks: chunks.length };
}

/** Semantic search placeholder — requires embeddings job to populate vectors. */
export async function semanticSearch(query: string, limit = 8) {
  void query;
  const chunks = await prisma.documentChunk.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { document: true },
  });
  return chunks;
}

export async function ensureVectorIndex() {
  await prisma.$executeRaw(
    Prisma.sql`CREATE EXTENSION IF NOT EXISTS vector`,
  );
}
