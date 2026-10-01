import { prisma } from "@/lib/db/prisma";
import { success, failure } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) return failure("NOT_FOUND", "Chat session not found", 404);

    const messages = session.messages
      .filter((m) => m.content && (m.role === "USER" || m.role === "ASSISTANT"))
      .map((m) => ({
        role: m.role.toLowerCase() as "user" | "assistant",
        content: m.content,
      }));

    const lastAssistant = [...session.messages]
      .reverse()
      .find((m) => m.role === "ASSISTANT");

    return success({
      id: session.id,
      title: session.title,
      messages,
      lastIntent: session.intent ?? null,
      lastPropertyIds: (lastAssistant?.propertyReferences as string[]) ?? [],
    });
  } catch (error) {
    return failure(
      "SESSION_ERROR",
      error instanceof Error ? error.message : "Failed to load session",
      500,
    );
  }
}
