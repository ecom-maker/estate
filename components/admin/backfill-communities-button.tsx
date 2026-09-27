"use client";

import { useActionState } from "react";
import {
  backfillCommunities,
  type BackfillState,
} from "@/app/admin/properties/actions";

export function BackfillCommunitiesButton() {
  const [state, formAction, pending] = useActionState<BackfillState, FormData>(
    backfillCommunities,
    {},
  );

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-sm border border-border bg-card px-4 py-2.5 text-sm font-medium text-primary transition hover:border-accent disabled:opacity-50"
          title="Create missing communities and link each property to the community implied by its title."
        >
          {pending ? "Backfilling…" : "Backfill communities"}
        </button>
      </form>

      {state.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : state.done ? (
        <p className="text-xs text-muted">
          {state.createdCommunities
            ? `${state.createdCommunities} ${state.createdCommunities > 1 ? "communities" : "community"} created · `
            : ""}
          {state.relinked ? `${state.relinked} relinked` : "all links already correct"}
          {state.unlinked && state.unlinked.length
            ? ` · ${state.unlinked.length} unmatched: ${state.unlinked.join(", ")}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
