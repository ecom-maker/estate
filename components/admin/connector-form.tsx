"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ConnectorFormState } from "@/app/admin/api-connectors/actions";

type ConnectorDefaults = {
  name?: string | null;
  type?: string | null;
  baseUrl?: string | null;
  syncFrequency?: string | null;
  priority?: number | null;
  enabled?: boolean | null;
  authType?: string | null;
  authHeaderName?: string | null;
  apiKeyConfigured?: boolean;
};

const TYPES = [
  "CRM",
  "MLS",
  "TRANSACTION",
  "COMMUNITY",
  "SCHOOL",
  "METRO",
  "AIRPORT",
  "OTHER",
];
const AUTH_TYPES = [
  { id: "bearer", label: "Bearer token (Authorization: Bearer …)" },
  { id: "header", label: "Custom header" },
  { id: "none", label: "None / public" },
];

const fieldClass =
  "mt-1.5 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm text-primary outline-none ring-accent focus:ring-2";
const labelClass =
  "text-[11px] font-medium uppercase tracking-wider text-muted";

export function ConnectorForm({
  action,
  connector,
  submitLabel = "Save connector",
}: {
  action: (
    state: ConnectorFormState,
    formData: FormData,
  ) => Promise<ConnectorFormState>;
  connector?: ConnectorDefaults;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<
    ConnectorFormState,
    FormData
  >(action, {});
  const [authType, setAuthType] = useState(connector?.authType ?? "bearer");

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state?.error ? (
        <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            Name *
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={connector?.name ?? ""}
            placeholder="CRM Production"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="type" className={labelClass}>
            Type *
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue={connector?.type ?? ""}
            className={fieldClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="baseUrl" className={labelClass}>
          Base URL
        </label>
        <input
          id="baseUrl"
          name="baseUrl"
          defaultValue={connector?.baseUrl ?? ""}
          placeholder="https://api.provider.com/v1"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="authType" className={labelClass}>
            Authentication
          </label>
          <select
            id="authType"
            name="authType"
            value={authType}
            onChange={(e) => setAuthType(e.target.value)}
            className={fieldClass}
          >
            {AUTH_TYPES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="authHeaderName" className={labelClass}>
            Header name {authType === "header" ? "" : "(header auth only)"}
          </label>
          <input
            id="authHeaderName"
            name="authHeaderName"
            defaultValue={connector?.authHeaderName ?? ""}
            placeholder="x-api-key"
            disabled={authType !== "header"}
            className={`${fieldClass} disabled:opacity-50`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="apiKey" className={labelClass}>
          API key{" "}
          {connector?.apiKeyConfigured
            ? "(configured — leave blank to keep)"
            : ""}
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder="paste the provider API key"
          disabled={authType === "none"}
          className={`${fieldClass} disabled:opacity-50`}
        />
        <p className="mt-1.5 text-xs text-muted">Stored encrypted at rest.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="syncFrequency" className={labelClass}>
            Sync frequency
          </label>
          <input
            id="syncFrequency"
            name="syncFrequency"
            defaultValue={connector?.syncFrequency ?? ""}
            placeholder="e.g. 15m, hourly, daily"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="priority" className={labelClass}>
            Priority
          </label>
          <input
            id="priority"
            name="priority"
            type="number"
            defaultValue={connector?.priority ?? 100}
            className={fieldClass}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-primary">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={connector?.enabled ?? false}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        Enabled
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/admin/api-connectors"
          className="text-sm text-muted hover:text-primary"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
