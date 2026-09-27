import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/rbac/guards";
import { KnowledgeForm } from "@/components/admin/knowledge-form";
import { updateKnowledge } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Knowledge Document" };

// Chunks overlap by this many characters (see chunkText in lib/ai/rag.ts).
// Legacy documents that predate the stored source text are rebuilt by
// stripping that overlap from every chunk after the first.
const CHUNK_OVERLAP = 120;

function reconstructFromChunks(
  chunks: { content: string; chunkIndex: number }[],
): string {
  return [...chunks]
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((c, i) => (i === 0 ? c.content : c.content.slice(CHUNK_OVERLAP)))
    .join("");
}

export default async function EditKnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await assertPermission("knowledge.manage");
  } catch {
    redirect(`/login?next=/admin/knowledge-base/${id}/edit`);
  }

  const doc = await prisma.knowledgeDocument.findFirst({
    where: { id, deletedAt: null },
    include: { chunks: { orderBy: { chunkIndex: "asc" } } },
  });
  if (!doc) notFound();

  const metadata = (doc.metadata ?? {}) as { sourceText?: string };
  const text =
    typeof metadata.sourceText === "string" && metadata.sourceText.length
      ? metadata.sourceText
      : reconstructFromChunks(doc.chunks);

  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <Link
        href="/admin/knowledge-base"
        className="text-xs text-muted hover:text-primary"
      >
        ← Back to knowledge base
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Knowledge
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Edit document</h1>
      <p className="mt-2 text-sm text-muted">Updating {doc.title}.</p>

      <KnowledgeForm
        action={updateKnowledge.bind(null, doc.id)}
        document={{
          title: doc.title,
          sourceType: doc.sourceType,
          text,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
