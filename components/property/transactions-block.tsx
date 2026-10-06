"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Txn } from "@/lib/property/market-insights";

function perSqft(r: Txn) {
  return Math.round(r.aed / Math.max(1, r.area)).toLocaleString();
}

function TxnTable({
  title,
  unit,
  perSqftLabel,
  rows,
}: {
  title: string;
  unit: string;
  perSqftLabel: string;
  rows: Txn[];
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-primary">{title}</p>
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary/[0.03] text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 text-right font-medium">{unit}</th>
              <th className="px-4 py-2.5 text-right font-medium">Area (sqft)</th>
              <th className="px-4 py-2.5 text-right font-medium">
                {perSqftLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2.5 text-muted">{r.date}</td>
                <td className="px-4 py-2.5 text-right text-primary">
                  {r.aed.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-muted">
                  {r.area.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-muted">
                  {perSqft(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TransactionsBlock({
  sold,
  rented,
  subtitle,
  buildingName,
}: {
  sold: Txn[];
  rented: Txn[];
  subtitle: string;
  buildingName: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section>
      <h2 className="font-serif text-2xl text-primary">
        Transactions in this building
      </h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <TxnTable
          title="Sold for"
          unit="AED"
          perSqftLabel="AED/sqft"
          rows={sold.slice(0, 5)}
        />
        <TxnTable
          title="Rented for"
          unit="AED/year"
          perSqftLabel="AED/sqft/yr"
          rows={rented.slice(0, 5)}
        />
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center rounded-sm border border-border px-4 py-2 text-sm font-medium text-primary transition hover:border-accent"
        >
          See all transactions in this location
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="All transactions in this location"
        >
          <div
            className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-sm border border-border bg-card shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <h3 className="font-serif text-xl text-primary">
                  All transactions in {buildingName}
                </h3>
                <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted transition hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-8 overflow-y-auto p-5 md:grid-cols-2">
              <TxnTable
                title="Sold for"
                unit="AED"
                perSqftLabel="AED/sqft"
                rows={sold}
              />
              <TxnTable
                title="Rented for"
                unit="AED/year"
                perSqftLabel="AED/sqft/yr"
                rows={rented}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
