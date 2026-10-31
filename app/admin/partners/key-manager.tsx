"use client";

import { useActionState } from "react";
import {
  createPartnerKeyAction,
  revokePartnerKeyAction,
  type PartnerKeyState,
} from "./actions";
import type { PartnerKeyView } from "@/lib/partners/keys";

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

export function PartnerKeyManager({ keys }: { keys: PartnerKeyView[] }) {
  const [createState, createForm, creating] = useActionState<
    PartnerKeyState,
    FormData
  >(createPartnerKeyAction, {});
  const [revokeState, revokeForm] = useActionState<PartnerKeyState, FormData>(
    revokePartnerKeyAction,
    {},
  );

  const active = keys.filter((k) => !k.revoked);

  return (
    <div>
      <form
        action={createForm}
        className="flex flex-wrap items-end gap-3 rounded-sm border border-border bg-card p-5"
      >
        <div className="min-w-[240px] flex-1">
          <label htmlFor="company" className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Partner company name
          </label>
          <input
            id="company"
            name="company"
            type="text"
            placeholder="e.g. Skyline Realty LLC"
            className={fieldClass}
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Issue key"}
        </button>
        {createState?.error ? (
          <span className="w-full text-sm text-red-600">{createState.error}</span>
        ) : null}
      </form>

      {createState?.created ? (
        <div className="mt-4 rounded-sm border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Key issued to “{createState.created.company}”. Share it securely —
            it won’t be shown again:
          </p>
          <code className="mt-2 block break-all rounded-sm border border-green-300 bg-white px-3 py-2 text-sm text-primary">
            {createState.created.plaintext}
          </code>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {active.length === 0 ? (
          <p className="text-sm text-muted">No partner keys issued yet.</p>
        ) : (
          active.map((k) => (
            <div
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium text-primary">{k.company}</p>
                <p className="text-xs text-muted">
                  source: partner:{k.partnerId} · {k.keyPrefix}… · created{" "}
                  {fmt(k.createdAt)} · last used {fmt(k.lastUsedAt)}
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
