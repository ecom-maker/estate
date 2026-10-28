"use client";

import { useActionState } from "react";
import { setOauthAction, type McpKeyState } from "./actions";

export function OauthToggle({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<McpKeyState, FormData>(
    setOauthAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <span className="text-sm">
        OAuth for the web connector is{" "}
        <strong className={enabled ? "text-green-700" : "text-amber-700"}>
          {enabled ? "ON" : "OFF"}
        </strong>
        .
      </span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-primary transition hover:border-accent disabled:opacity-50"
      >
        {pending ? "Saving…" : enabled ? "Turn off" : "Turn on"}
      </button>
      {state?.error ? (
        <span className="text-sm text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
