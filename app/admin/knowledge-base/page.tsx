import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { deleteKnowledge } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge Base" };

export default async function AdminKnowledgePage() {
  let items: Array<{
    id: string;
    title: string;
    sourceType: string;
    status: string;
    updatedAt: Date;
    _count: { chunks: number };
  }> = [];

  try {
    items = await prisma.knowledgeDocument.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { chunks: true } } },
    });
  } catch {
    items = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-28 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
            Admin · Knowledge
          </p>
          <h1 className="mt-3 font-serif text-4xl text-primary">
            Knowledge Base
          </h1>
          <p className="mt-2 text-sm text-muted">
            Community guides, FAQs, and brochures for RAG. Create or edit
            content here — it is re-chunked on save; embeddings require an
            embedding-capable AI key.
          </p>
        </div>
        <Link
          href="/admin/knowledge-base/new"
          className="inline-flex items-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          + New document
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th>Source</th>
              <th>Status</th>
              <th>Chunks</th>
              <th>Updated</th>
              <th className="px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={6}>
                  No documents yet.{" "}
                  <Link
                    href="/admin/knowledge-base/new"
                    className="text-accent hover:underline"
                  >
                    Add your first one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-primary">{item.title}</td>
                  <td className="text-muted">{item.sourceType}</td>
                  <td className="text-muted">{item.status}</td>
                  <td className="text-muted">{item._count.chunks}</td>
                  <td className="text-muted">
                    {item.updatedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/admin/knowledge-base/${item.id}/edit`}
                        className="font-medium text-accent hover:underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteKnowledge.bind(null, item.id)}>
                        <button
                          type="submit"
                          className="text-muted transition hover:text-red-600"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
