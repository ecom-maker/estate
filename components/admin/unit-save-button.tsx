"use client";

import { useActionState } from "react";
import { updateUnitDetails, type UnitDetailsState } from "@/app/admin/properties/actions";

/**
 * Save for one row of the Units table. The row's inputs live in other cells
 * and join this form through their `form` attribute.
 */
export function UnitSaveButton({ id, formId }: { id: string; formId: string }) {
  const [state, action, pending] = useActionState<UnitDetailsState, FormData>(
    updateUnitDetails,
    {},
  );
  return (
    <form id={formId} action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-primary transition hover:border-accent disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error ? (
        <span role="alert" className="max-w-[160px] text-[11px] text-red-600">
          {state.error}
        </span>
      ) : state.ok && !pending ? (
        <span className="text-[11px] text-accent">Saved</span>
      ) : null}
    </form>
  );
}
