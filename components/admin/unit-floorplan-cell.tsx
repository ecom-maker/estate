"use client";

import { useActionState, useRef } from "react";
import {
  removeUnitFloorplan,
  uploadUnitFloorplan,
  type UnitDetailsState,
} from "@/app/admin/properties/actions";

/** Floor plan for one unit in the admin Units table: preview, upload, remove. */
export function UnitFloorplanCell({ id, url }: { id: string; url: string | null }) {
  const [state, action, pending] = useActionState<UnitDetailsState, FormData>(
    uploadUnitFloorplan,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex items-center gap-2">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title="Open floor plan">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Floor plan"
            className="h-10 w-12 rounded-sm border border-border bg-background object-cover"
          />
        </a>
      ) : null}
      <div className="flex flex-col items-start gap-0.5">
        <form ref={formRef} action={action}>
          <input type="hidden" name="id" value={id} />
          <label
            className={`cursor-pointer text-xs font-medium text-accent hover:underline ${
              pending ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {pending ? "Uploading…" : url ? "Replace" : "Upload"}
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                if (e.currentTarget.files?.length) formRef.current?.requestSubmit();
              }}
            />
          </label>
        </form>
        {url && !pending ? (
          <form action={removeUnitFloorplan}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="text-[11px] text-muted hover:text-red-600">
              Remove
            </button>
          </form>
        ) : null}
        {state.error ? (
          <span role="alert" className="max-w-[140px] text-[11px] text-red-600">
            {state.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
