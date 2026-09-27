import Link from "next/link";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/rbac/guards";
import { KnowledgeForm } from "@/components/admin/knowledge-form";
import { createKnowledge } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Knowledge Document" };

export default async function NewKnowledgePage() {
  try {
    await assertPermission("knowledge.manage");
  } catch {
    redirect("/login?next=/admin/knowledge-base/new");
  }

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
      <h1 className="mt-3 font-serif text-4xl text-primary">New document</h1>
      <p className="mt-2 text-sm text-muted">
        Add a community guide, FAQ, or brochure. Content is chunked for RAG on
        save.
      </p>

      <KnowledgeForm action={createKnowledge} submitLabel="Create document" />
    </div>
  );
}
