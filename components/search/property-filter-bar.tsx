"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { v: string; l: string };

const TYPES: Option[] = [
  { v: "", l: "Property type" },
  { v: "villa", l: "Villa" },
  { v: "apartment", l: "Apartment" },
  { v: "penthouse", l: "Penthouse" },
  { v: "townhouse", l: "Townhouse" },
];

const BEDS: Option[] = [
  { v: "", l: "Beds & Baths" },
  { v: "1", l: "1 bed" },
  { v: "2", l: "2 beds" },
  { v: "3", l: "3 beds" },
  { v: "4", l: "4 beds" },
  { v: "5", l: "5+ beds" },
];

const PRICES: Option[] = [
  { v: "", l: "Price" },
  { v: "5", l: "Under AED 5M" },
  { v: "10", l: "Under AED 10M" },
  { v: "20", l: "Under AED 20M" },
  { v: "50", l: "Under AED 50M" },
];

function PillSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "cursor-pointer appearance-none rounded-full border border-border bg-white py-2 pl-4 pr-9 text-sm outline-none transition focus:border-accent",
          value ? "text-accent" : "text-primary/70",
        )}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}

export function PropertyFilterBar({ dealType }: { dealType: "rent" | "buy" }) {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [beds, setBeds] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<"" | "offplan" | "ready">("");

  function search() {
    // Compose a natural-language query so the existing intent extraction and
    // search pipeline handle the filters — no separate filtered endpoint needed.
    const parts: string[] = [];
    if (beds) parts.push(`${beds} bed`);
    parts.push(type || "property");
    if (city.trim()) parts.push(`in ${city.trim()}`);
    if (status === "offplan") parts.push("off-plan");
    if (status === "ready") parts.push("ready");
    if (price) parts.push(`under AED ${price}M`);
    parts.push(dealType === "rent" ? "for rent" : "for sale");
    const q = parts.join(" ");
    router.push(`/search?${new URLSearchParams({ q }).toString()}`);
  }

  return (
    <div className="rounded-sm border border-white/15 bg-white/95 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="flex items-center gap-3 border-b border-border px-1 pb-3">
        <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <label htmlFor="filter-city" className="sr-only">
          City, community or building
        </label>
        <input
          id="filter-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
          placeholder="City, community or building"
          className="w-full bg-transparent text-base text-primary outline-none placeholder:text-muted"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PillSelect value={type} onChange={setType} options={TYPES} />
        <PillSelect value={beds} onChange={setBeds} options={BEDS} />
        <PillSelect value={price} onChange={setPrice} options={PRICES} />

        <div className="inline-flex items-center rounded-full border border-border bg-white text-sm">
          <button
            type="button"
            aria-pressed={status === "offplan"}
            onClick={() => setStatus(status === "offplan" ? "" : "offplan")}
            className={cn(
              "rounded-full px-4 py-2 transition",
              status === "offplan" ? "text-accent" : "text-primary/70",
            )}
          >
            Off-plan
          </button>
          <span className="h-5 w-px bg-border" aria-hidden />
          <button
            type="button"
            aria-pressed={status === "ready"}
            onClick={() => setStatus(status === "ready" ? "" : "ready")}
            className={cn(
              "rounded-full px-4 py-2 transition",
              status === "ready" ? "text-accent" : "text-primary/70",
            )}
          >
            Ready
          </button>
        </div>

        <button
          type="button"
          onClick={search}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Search className="h-4 w-4" aria-hidden />
          Search
        </button>
      </div>
    </div>
  );
}
