"use client";

import { useMemo, useState } from "react";
import { formatAED } from "@/lib/utils";

type CompareItem = {
  id: string;
  title: string;
  priceAed: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  community?: string | null;
  rentalYield?: number | null;
  developer?: string | null;
};

export function CompareTable({ items }: { items: CompareItem[] }) {
  const [selected, setSelected] = useState<string[]>(
    items.slice(0, 3).map((i) => i.id),
  );

  const visible = useMemo(
    () => items.filter((item) => selected.includes(item.id)),
    [items, selected],
  );

  const rows: Array<[string, (item: CompareItem) => string]> = [
    ["Price", (i) => formatAED(i.priceAed)],
    ["Bedrooms", (i) => String(i.bedrooms ?? "—")],
    ["Bathrooms", (i) => String(i.bathrooms ?? "—")],
    ["Area", (i) => (i.areaSqft ? `${i.areaSqft} sqft` : "—")],
    ["Community", (i) => i.community ?? "—"],
    ["Developer", (i) => i.developer ?? "—"],
    [
      "Rental yield",
      (i) => (i.rentalYield != null ? `${i.rentalYield}%` : "Not available"),
    ],
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setSelected((prev) =>
                  active
                    ? prev.filter((id) => id !== item.id)
                    : [...prev, item.id].slice(0, 4),
                )
              }
              className={`rounded-sm border px-3 py-1.5 text-xs ${
                active
                  ? "border-accent bg-accent/10 text-primary"
                  : "border-border text-muted"
              }`}
            >
              {item.title}
            </button>
          );
        })}
      </div>

      {visible.length < 2 ? (
        <p className="text-sm text-muted">Select at least two properties.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-4">Attribute</th>
                {visible.map((item) => (
                  <th key={item.id} className="py-3 pr-4 font-serif text-base normal-case tracking-normal text-primary">
                    {item.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, getter]) => (
                <tr key={label} className="border-b border-border">
                  <td className="py-3 pr-4 text-muted">{label}</td>
                  {visible.map((item) => (
                    <td key={item.id} className="py-3 pr-4 text-primary">
                      {getter(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
