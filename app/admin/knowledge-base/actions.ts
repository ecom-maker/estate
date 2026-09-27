"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { indexDocumentText } from "@/lib/ai/rag";
import { assertPermission } from "@/lib/rbac/guards";
import type { Prisma } from "@prisma/client";

export type KnowledgeFormState = { error?: string };

function parseForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    sourceType: String(formData.get("sourceType") ?? "").trim(),
    text: String(formData.get("text") ?? "").trim(),
  };
}

function validate(input: ReturnType<typeof parseForm>): string | null {
  if (input.title.length < 2) return "Title is required.";
  if (input.sourceType.length < 2) return "Source type is required.";
  if (input.text.length < 20)
    return "Content must be at least 20 characters so it can be chunked.";
  return null;
}

export async function createKnowledge(
  _prev: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  try {
    await assertPermission("knowledge.manage");
  } catch {
    return { error: "You must be signed in as an admin to add documents." };
  }

  const input = parseForm(formData);
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  try {
    const doc = await prisma.knowledgeDocument.create({
      data: {
        title: input.title,
        sourceType: input.sourceType,
        status: "processing",
        // Keep the editable source alongside the chunks so it can be re-edited.
        metadata: { seed: false, sourceText: input.text } as Prisma.InputJsonValue,
      },
    });
    await indexDocumentText({ documentId: doc.id, text: input.text });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create document.",
    };
  }

  revalidatePath("/admin/knowledge-base");
  redirect("/admin/knowledge-base");
}

export async function updateKnowledge(
  id: string,
  _prev: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  try {
    await assertPermission("knowledge.manage");
  } catch {
    return { error: "You must be signed in as an admin to edit documents." };
  }

  const input = parseForm(formData);
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  try {
    const existing = await prisma.knowledgeDocument.findUnique({
      where: { id },
      select: { metadata: true },
    });
    const metadata = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
      sourceText: input.text,
    };

    await prisma.knowledgeDocument.update({
      where: { id },
      data: {
        title: input.title,
        sourceType: input.sourceType,
        status: "processing",
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    // Re-chunk (and re-embed) from the edited text; replaces old chunks.
    await indexDocumentText({ documentId: id, text: input.text });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update document.",
    };
  }

  revalidatePath("/admin/knowledge-base");
  revalidatePath(`/admin/knowledge-base/${id}/edit`);
  redirect("/admin/knowledge-base");
}

export async function deleteKnowledge(id: string): Promise<void> {
  try {
    await assertPermission("knowledge.manage");
  } catch {
    return;
  }
  await prisma.knowledgeDocument.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/admin/knowledge-base");
}
