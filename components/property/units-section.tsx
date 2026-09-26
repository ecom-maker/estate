"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type UnitRow = {
  id: string;
  layoutType: string;
  bathrooms: number | null;
  areaSqft: number | null;
  floorplanUrl: string;
  floorplanTitle: string;
};

export type UnitGroup = {
  key: string;
  label: string;
  fromLabel: string;
  bathrooms: number | null;
  units: UnitRow[];
};

export function UnitsSection({
  category,
  groups,
}: {
  category: string;
  groups: UnitGroup[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(groups[0]?.key ?? null);
  const [plan, setPlan] = useState<{ url: string; title: string } | null>(null);

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-primary">Units</h2>
      <p className="mt-1 text-sm text-muted">from developer</p>

      <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-muted">
        {category}
      </p>

      <div className="mt-3 space-y-2">
        {groups.map((g) => {
          const isOpen = openKey === g.key;
          return (
            <div
              key={g.key}
              className="overflow-hidden rounded-sm border border-border"
            >
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : g.key)}
                aria-expanded={isOpen}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-3 text-left transition",
                  isOpen ? "bg-accent/10" : "bg-card hover:bg-accent/5",
                )}
              >
                <span className="font-medium text-primary">{g.label}</span>
                {g.fromLabel ? (
                  <span className="text-sm text-muted">{g.fromLabel}</span>
                ) : null}
                <span className="ml-auto text-sm text-muted">
                  {g.bathrooms ?? "—"} bath
                </span>
                <span
                  className={cn(
                    "text-muted transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                >
                  ▾
                </span>
              </button>

              {isOpen ? (
                <div className="overflow-x-auto border-t border-border bg-card">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-4 py-3">Layout type</th>
                        <th>Size (sqft)</th>
                        <th>No. of Bathrooms</th>
                        <th className="px-4 text-right">Floor plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.units.map((u) => (
                        <tr key={u.id} className="border-t border-border">
                          <td className="px-4 py-4 text-primary">
                            {u.layoutType}
                          </td>
                          <td className="text-muted">
                            {u.areaSqft ? u.areaSqft.toLocaleString() : "—"}
                          </td>
                          <td className="text-muted">{u.bathrooms ?? "—"}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setPlan({
                                  url: u.floorplanUrl,
                                  title: u.floorplanTitle,
                                })
                              }
                              className="inline-block overflow-hidden rounded-sm border border-border transition hover:border-accent"
                              aria-label={`Open floor plan for ${u.layoutType}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={u.floorplanUrl}
                                alt={u.floorplanTitle}
                                className="h-16 w-20 bg-background object-cover"
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {plan ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={plan.title}
          onClick={() => setPlan(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-3xl overflow-auto rounded-sm bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPlan(null)}
              aria-label="Close floor plan"
              className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-lg leading-none text-primary shadow"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={plan.url}
              alt={plan.title}
              className="mx-auto max-h-[82vh] w-auto"
            />
            <p className="mt-3 text-center text-sm text-muted">{plan.title}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
