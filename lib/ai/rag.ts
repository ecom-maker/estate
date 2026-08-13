import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveOpenAIKey } from "@/lib/ai/openai-key";

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

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const apiKey = await resolveOpenAIKey();
  if (!apiKey || texts.length === 0) return null;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((row) => row.embedding);
}

export async function indexDocumentText(params: {
  documentId: string;
  text: string;
}) {
  const chunks = await chunkText(params.text);
  await prisma.documentChunk.deleteMany({
    where: { documentId: params.documentId },
  });

  const embeddings = await embedTexts(chunks);

  for (const [index, content] of chunks.entries()) {
    const created = await prisma.documentChunk.create({
      data: {
        documentId: params.documentId,
        content,
        chunkIndex: index,
        tokenCount: Math.ceil(content.length / 4),
      },
    });

    const vector = embeddings?.[index];
    if (vector) {
      const literal = `[${vector.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE document_chunks
        SET embedding = ${literal}::vector
        WHERE id = ${created.id}
      `;
    }
  }

  await prisma.knowledgeDocument.update({
    where: { id: params.documentId },
    data: { status: embeddings ? "indexed" : "chunked" },
  });

  return { chunks: chunks.length, embedded: Boolean(embeddings) };
}

export async function semanticSearch(query: string, limit = 8) {
  const [embedding] = (await embedTexts([query])) ?? [];
  if (!embedding) {
    return prisma.documentChunk.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { document: true },
    });
  }

  const literal = `[${embedding.join(",")}]`;
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      content: string;
      document_id: string;
      distance: number;
    }>
  >`
    SELECT id, content, document_id, embedding <=> ${literal}::vector AS distance
    FROM document_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${limit}
  `;

  return rows;
}

export async function ensureVectorIndex() {
  await prisma.$executeRaw(Prisma.sql`CREATE EXTENSION IF NOT EXISTS vector`);
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `.catch(() => undefined);
}
