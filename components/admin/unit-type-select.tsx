"use client";

import { useRef } from "react";
import { setUnitType } from "@/app/admin/properties/actions";

const TYPES = ["APARTMENT", "PENTHOUSE", "TOWNHOUSE", "VILLA", "UNIT", "LAND"];
const label = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

/** A unit's own type; saves on change. "Same as project" = unknown. */
export function UnitTypeSelect({
  id,
  value,
  projectType,
}: {
  id: string;
  value: string | null;
  projectType: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setUnitType}>
      <input type="hidden" name="id" value={id} />
      <select
        name="unitType"
        defaultValue={value ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Unit type"
        className="rounded-sm border border-border bg-card px-2 py-1 text-xs text-primary"
      >
        <option value="">Default ({label(projectType)})</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {label(t)}
          </option>
        ))}
      </select>
    </form>
  );
}
