import { prisma } from "@/lib/db/prisma";

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
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Admin · Knowledge
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Knowledge Base</h1>
      <p className="mt-2 text-sm text-muted">
        Upload community guides, FAQs, and brochures for RAG. Chunking runs
        immediately; embeddings require an OpenAI key.
      </p>

      <form
        action="/api/knowledge"
        method="post"
        className="mt-8 grid max-w-2xl gap-3 rounded-sm border border-border bg-card p-6"
      >
        <p className="text-sm text-muted">
          Prefer JSON API <code>POST /api/knowledge</code> for production
          uploads. Demo form posts title/text via fetch from scripts.
        </p>
      </form>

      <div className="mt-8 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th>Source</th>
              <th>Status</th>
              <th>Chunks</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={5}>
                  No documents yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3 text-primary">{item.title}</td>
                  <td>{item.sourceType}</td>
                  <td>{item.status}</td>
                  <td>{item._count.chunks}</td>
                  <td>{item.updatedAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
