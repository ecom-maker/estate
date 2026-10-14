"use client";

import { useRef } from "react";
import { setUnitListing } from "@/app/admin/properties/actions";

const OPTIONS = [
  ["sale", "For sale"],
  ["rent", "For rent"],
  ["both", "Sale & rent"],
] as const;

/** Whether a unit is listed for sale, rent, or both; saves on change. */
export function UnitListingSelect({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setUnitListing}>
      <input type="hidden" name="id" value={id} />
      <select
        name="listing"
        defaultValue={value ?? "sale"}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Listing (sale or rent)"
        className="rounded-sm border border-border bg-card px-2 py-1 text-xs text-primary"
      >
        {OPTIONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </form>
  );
}
