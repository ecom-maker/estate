"use client";

import { useMemo, useState } from "react";
import { DeveloperRow, type DeveloperRowData } from "./developer-row";

export function DevelopersList({
  developers,
}: {
  developers: DeveloperRowData[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return developers;
    return developers.filter((d) =>
      [d.name, d.email ?? "", d.phone ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [developers, query]);

  return (
    <div className="mt-8">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search developers by name, email or phone…"
        aria-label="Search developers"
        className="w-full rounded-sm border border-border bg-card px-3 py-2 text-sm text-primary outline-none ring-accent focus:ring-2"
      />

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No developers match “{query}”.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {filtered.map((d) => (
            <DeveloperRow key={d.id} developer={d} />
          ))}
        </div>
      )}
    </div>
  );
}
