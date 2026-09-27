"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { KnowledgeFormState } from "@/app/admin/knowledge-base/actions";

type KnowledgeDefaults = {
  title?: string | null;
  sourceType?: string | null;
  text?: string | null;
};

const SOURCE_TYPES = [
  "community-guide",
  "faq",
  "brochure",
  "developer-note",
  "policy",
  "other",
];

const fieldClass =
  "mt-1.5 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm text-primary outline-none ring-accent focus:ring-2";
const labelClass =
  "text-[11px] font-medium uppercase tracking-wider text-muted";

export function KnowledgeForm({
  action,
  document,
  submitLabel = "Save document",
}: {
  action: (
    state: KnowledgeFormState,
    formData: FormData,
  ) => Promise<KnowledgeFormState>;
  document?: KnowledgeDefaults;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<
    KnowledgeFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state?.error ? (
        <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className={labelClass}>
            Title *
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={document?.title ?? ""}
            placeholder="Palm Jumeirah Community Guide"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="sourceType" className={labelClass}>
            Source type *
          </label>
          <input
            id="sourceType"
            name="sourceType"
            required
            list="knowledge-source-types"
            defaultValue={document?.sourceType ?? "community-guide"}
            placeholder="community-guide"
            className={fieldClass}
          />
          <datalist id="knowledge-source-types">
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label htmlFor="text" className={labelClass}>
          Content *
        </label>
        <textarea
          id="text"
          name="text"
          required
          rows={18}
          defaultValue={document?.text ?? ""}
          placeholder="Paste or write the guide content. It is chunked for retrieval on save."
          className={`${fieldClass} min-h-[320px] font-mono leading-relaxed`}
        />
        <p className="mt-1.5 text-xs text-muted">
          Saving re-chunks the content for RAG. Embeddings are generated when an
          embedding-capable AI key is configured; otherwise it stays keyword-
          searchable.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/admin/knowledge-base"
          className="text-sm text-muted hover:text-primary"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
