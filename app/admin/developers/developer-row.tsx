"use client";

import { useActionState } from "react";
import { saveDeveloper, type DeveloperFormState } from "./actions";

export type DeveloperRowData = {
  id: string;
  name: string;
  propertyCount: number;
  email: string | null;
  phone: string | null;
  nocUrl: string | null;
};

const fieldClass =
  "mt-1.5 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm text-primary outline-none ring-accent focus:ring-2";
const labelClass =
  "text-[11px] font-medium uppercase tracking-wider text-muted";

export function DeveloperRow({ developer }: { developer: DeveloperRowData }) {
  const [state, formAction, pending] = useActionState<
    DeveloperFormState,
    FormData
  >(saveDeveloper.bind(null, developer.id), {});

  return (
    <form
      action={formAction}
      className="rounded-sm border border-border bg-card p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl text-primary">{developer.name}</h2>
        <span className="text-xs text-muted">
          {developer.propertyCount} listing
          {developer.propertyCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`email-${developer.id}`} className={labelClass}>
            Email
          </label>
          <input
            id={`email-${developer.id}`}
            name="email"
            type="email"
            defaultValue={developer.email ?? ""}
            placeholder="sales@developer.com"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`phone-${developer.id}`} className={labelClass}>
            Contact number
          </label>
          <input
            id={`phone-${developer.id}`}
            name="phone"
            type="tel"
            defaultValue={developer.phone ?? ""}
            placeholder="+971 50 000 0000"
            className={fieldClass}
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={`noc-${developer.id}`} className={labelClass}>
          NOC (No Objection Certificate)
        </label>
        <input
          id={`noc-${developer.id}`}
          name="noc"
          type="file"
          accept="application/pdf,image/png"
          className={`${fieldClass} file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:text-primary-foreground`}
        />
        <p className="mt-1.5 text-xs text-muted">PDF or PNG only (max 3.5 MB).</p>
        {developer.nocUrl ? (
          <div className="mt-2 flex items-center gap-4 text-xs">
            <a
              href={developer.nocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              View current NOC
            </a>
            <label className="flex items-center gap-1.5 text-muted">
              <input type="checkbox" name="nocRemove" />
              Remove
            </label>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.error ? (
          <span className="text-sm text-red-600">{state.error}</span>
        ) : state?.ok ? (
          <span className="text-sm text-green-600">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}
