"use client";

import { useActionState, useEffect, useRef } from "react";
import type { UnitDetailsState } from "@/app/admin/properties/actions";

const TYPES = ["APARTMENT", "PENTHOUSE", "TOWNHOUSE", "VILLA", "UNIT", "LAND"];
const STATUSES = ["available", "reserved", "sold"];
const label = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

const fieldClass =
  "mt-1 w-full rounded-sm border border-border bg-card px-2.5 py-1.5 text-sm text-primary";
const labelClass = "text-[11px] font-medium uppercase tracking-wider text-muted";

/** "Add unit" form under a property's Units table. */
export function AddUnitForm({
  action,
  projectType,
}: {
  action: (state: UnitDetailsState, formData: FormData) => Promise<UnitDetailsState>;
  projectType: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a unit is added, ready for the next one.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-4 rounded-sm border border-dashed border-border bg-card/60 p-4"
    >
      <p className="text-sm font-medium text-primary">Add a unit</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <label className="col-span-2 sm:col-span-1">
          <span className={labelClass}>Unit # *</span>
          <input name="unitNumber" required maxLength={40} placeholder="PH-01" className={fieldClass} />
        </label>
        <label className="col-span-2 sm:col-span-1">
          <span className={labelClass}>Type</span>
          <select name="unitType" defaultValue="" className={fieldClass}>
            <option value="">Default ({label(projectType)})</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Beds</span>
          <input name="bedrooms" type="number" min={0} max={20} step={1} placeholder="0 = studio" className={fieldClass} />
        </label>
        <label>
          <span className={labelClass}>Baths</span>
          <input name="bathrooms" type="number" min={1} max={20} step={1} className={fieldClass} />
        </label>
        <label>
          <span className={labelClass}>Area (sqft)</span>
          <input name="areaSqft" inputMode="numeric" className={fieldClass} />
        </label>
        <label>
          <span className={labelClass}>Price (AED)</span>
          <input name="priceAed" inputMode="numeric" className={fieldClass} />
        </label>
        <label>
          <span className={labelClass}>Status</span>
          <select name="status" defaultValue="available" className={fieldClass}>
            <option value="">—</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add unit"}
          </button>
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : state.ok && !pending ? (
        <p className="mt-2 text-sm text-accent">Unit added.</p>
      ) : null}
    </form>
  );
}
