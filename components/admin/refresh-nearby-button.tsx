"use client";

import { useActionState } from "react";
import {
  refreshNearbyData,
  type RefreshNearbyState,
} from "@/app/admin/properties/actions";

const initial: RefreshNearbyState = {};

export function RefreshNearbyButton({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(refreshNearbyData, initial);

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={propertyId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-sm border border-border px-4 py-2 text-sm font-medium text-primary transition hover:border-accent disabled:opacity-60"
      >
        {pending ? "Refreshing…" : "Refresh nearby data"}
      </button>
      {state.ok ? (
        <span className="text-sm text-green-700">Refreshed ✓</span>
      ) : null}
      {state.error ? (
        <span className="text-sm text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
