"use client";

import { useActionState } from "react";
import {
  createKeyAction,
  revokeKeyAction,
  type McpKeyState,
} from "./actions";
import type { KeyView } from "@/lib/mcp/keys";

const fieldClass =
  "mt-1.5 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm text-primary outline-none ring-accent focus:ring-2";

function fmt(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function KeyManager({ keys }: { keys: KeyView[] }) {
  const [createState, createForm, creating] = useActionState<
    McpKeyState,
    FormData
  >(createKeyAction, {});
  const [revokeState, revokeForm] = useActionState<McpKeyState, FormData>(
    revokeKeyAction,
    {},
  );

  const active = keys.filter((k) => !k.revoked);

  return (
    <div>
      <form
        action={createForm}
        className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-5"
      >
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="label" className="text-[11px] font-medium uppercase tracking-wider text-muted">
            New key label
          </label>
          <input
            id="label"
            name="label"
            type="text"
            placeholder="e.g. Partner agent CRM"
            className={fieldClass}
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create key"}
        </button>
        {createState?.error ? (
          <span className="w-full text-sm text-red-600">{createState.error}</span>
        ) : null}
      </form>

      {createState?.created ? (
        <div className="mt-4 rounded-sm border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Key created for “{createState.created.label}”. Copy it now — it won’t
            be shown again:
          </p>
          <code className="mt-2 block break-all rounded-sm border border-green-300 bg-white px-3 py-2 text-sm text-primary">
            {createState.created.plaintext}
          </code>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {active.length === 0 ? (
          <p className="text-sm text-muted">
            No active keys. The MCP server is open until you create one.
          </p>
        ) : (
          active.map((k) => (
            <div
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium text-primary">{k.label}</p>
                <p className="text-xs text-muted">
                  {k.keyPrefix}… · created {fmt(k.createdAt)} · last used{" "}
                  {fmt(k.lastUsedAt)}
                </p>
              </div>
              <form action={revokeForm}>
                <input type="hidden" name="id" value={k.id} />
                <button
                  type="submit"
                  className="rounded-sm border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                >
                  Revoke
                </button>
              </form>
            </div>
          ))
        )}
        {revokeState?.error ? (
          <p className="text-sm text-red-600">{revokeState.error}</p>
        ) : null}
      </div>
    </div>
  );
}
