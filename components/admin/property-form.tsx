"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { PropertyFormState } from "@/app/admin/properties/actions";

type Community = { id: string; name: string };

type PropertyDefaults = {
  title?: string | null;
  slug?: string | null;
  type?: string | null;
  status?: string | null;
  communityId?: string | null;
  dealType?: string | null;
  priceAed?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqft?: number | null;
  description?: string | null;
  offPlan?: boolean | null;
  ready?: boolean | null;
  waterfront?: boolean | null;
  furnished?: boolean | null;
  handoverDate?: string | null;
};

const TYPES = ["VILLA", "APARTMENT", "PENTHOUSE", "TOWNHOUSE", "UNIT", "LAND"];
const STATUSES = ["DRAFT", "ACTIVE", "RESERVED", "SOLD", "OFF_MARKET"];

const fieldClass =
  "mt-1.5 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm text-primary outline-none ring-accent focus:ring-2";
const labelClass =
  "text-[11px] font-medium uppercase tracking-wider text-muted";

export function PropertyForm({
  action,
  communities,
  property,
  submitLabel = "Save property",
}: {
  action: (
    state: PropertyFormState,
    formData: FormData,
  ) => Promise<PropertyFormState>;
  communities: Community[];
  property?: PropertyDefaults;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<
    PropertyFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state?.error ? (
        <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="title" className={labelClass}>
          Title *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={property?.title ?? ""}
          placeholder="Palm Frond Signature Villa"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="slug" className={labelClass}>
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          defaultValue={property?.slug ?? ""}
          placeholder="leave blank to auto-generate from the title"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label htmlFor="type" className={labelClass}>
            Type *
          </label>
          <select
            id="type"
            name="type"
            defaultValue={property?.type ?? ""}
            required
            className={fieldClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={property?.status ?? "DRAFT"}
            className={fieldClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="communityId" className={labelClass}>
            Community
          </label>
          <select
            id="communityId"
            name="communityId"
            defaultValue={property?.communityId ?? ""}
            className={fieldClass}
          >
            <option value="">None</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="dealType" className={labelClass}>
            Listing type
          </label>
          <select
            id="dealType"
            name="dealType"
            defaultValue={property?.dealType ?? "sale"}
            className={fieldClass}
          >
            <option value="sale">For sale</option>
            <option value="rent">For rent</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-4">
        <div>
          <label htmlFor="priceAed" className={labelClass}>
            Price (AED)
          </label>
          <input
            id="priceAed"
            name="priceAed"
            type="number"
            min="0"
            step="1000"
            defaultValue={property?.priceAed ?? ""}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="bedrooms" className={labelClass}>
            Bedrooms
          </label>
          <input
            id="bedrooms"
            name="bedrooms"
            type="number"
            min="0"
            defaultValue={property?.bedrooms ?? ""}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="bathrooms" className={labelClass}>
            Bathrooms
          </label>
          <input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min="0"
            defaultValue={property?.bathrooms ?? ""}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="areaSqft" className={labelClass}>
            Area (sqft)
          </label>
          <input
            id="areaSqft"
            name="areaSqft"
            type="number"
            min="0"
            defaultValue={property?.areaSqft ?? ""}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="handoverDate" className={labelClass}>
          Handover / completion date
        </label>
        <input
          id="handoverDate"
          name="handoverDate"
          type="date"
          defaultValue={property?.handoverDate ?? ""}
          className={fieldClass}
        />
        <p className="mt-1.5 text-xs text-muted">
          Shown as the delivery date for off-plan, or the completed date for
          ready properties.
        </p>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={property?.description ?? ""}
          className={fieldClass}
        />
      </div>

      <fieldset className="flex flex-wrap gap-6">
        {(
          [
            ["offPlan", "Off-plan", property?.offPlan],
            ["ready", "Ready / completed", property?.ready],
            ["waterfront", "Waterfront", property?.waterfront],
            ["furnished", "Furnished", property?.furnished],
          ] as const
        ).map(([name, label, checked]) => (
          <label
            key={name}
            className="flex items-center gap-2 text-sm text-primary"
          >
            <input
              type="checkbox"
              name={name}
              defaultChecked={Boolean(checked)}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/admin/properties"
          className="text-sm text-muted hover:text-primary"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
