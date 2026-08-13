import { z } from "zod";
import { failure, success } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { indexDocumentText } from "@/lib/ai/rag";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/check";
import type { Prisma } from "@prisma/client";

const createSchema = z.object({
  title: z.string().min(2),
  sourceType: z.string().min(2),
  text: z.string().min(20),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  try {
    const items = await prisma.knowledgeDocument.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { _count: { select: { chunks: true } } },
    });
    return success({ items });
  } catch (error) {
    return failure(
      "KNOWLEDGE_ERROR",
      error instanceof Error ? error.message : "Failed",
      500,
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (
    process.env.NODE_ENV === "production" &&
    !hasPermission(roles, "knowledge.manage")
  ) {
    return failure("FORBIDDEN", "Missing permission", 403);
  }

  try {
    const body = createSchema.parse(await request.json());
    const doc = await prisma.knowledgeDocument.create({
      data: {
        title: body.title,
        sourceType: body.sourceType,
        status: "processing",
        metadata: (body.metadata ?? { seed: false }) as Prisma.InputJsonValue,
      },
    });

    const indexed = await indexDocumentText({
      documentId: doc.id,
      text: body.text,
    });

    return success({ document: doc, ...indexed });
  } catch (error) {
    return failure(
      "KNOWLEDGE_ERROR",
      error instanceof Error ? error.message : "Failed",
      400,
    );
  }
}
