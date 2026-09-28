"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

const PRICES: Option[] = [
  { v: "", l: "Price" },
  { v: "5", l: "Under AED 5M" },
  { v: "10", l: "Under AED 10M" },
  { v: "20", l: "Under AED 20M" },
  { v: "50", l: "Under AED 50M" },
];

const BEDROOMS = ["studio", "1", "2", "3", "4", "5", "6", "7", "7+"];
const BATHROOMS = ["1", "2", "3", "4", "5", "6", "7", "7+"];

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

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-w-[3rem] rounded-full border px-4 py-2 text-sm transition",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-primary/80 hover:border-accent/60",
      )}
    >
      {label}
    </button>
  );
}

function BedsBaths({
  beds,
  baths,
  onBeds,
  onBaths,
}: {
  beds: string;
  baths: string;
  onBeds: (v: string) => void;
  onBaths: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const label = (() => {
    const b = beds === "studio" ? "Studio" : beds ? `${beds} Bed` : "";
    const ba = baths ? `${baths} Bath` : "";
    if (b && ba) return `${b}, ${ba}`;
    return b || ba || "Beds & Baths";
  })();

  const selected = Boolean(beds || baths);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-white py-2 pl-4 pr-3 text-sm transition focus:border-accent",
          selected ? "text-accent" : "text-primary/70",
        )}
      >
        {label}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-[320px] max-w-[80vw] rounded-md border border-border bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
          <p className="text-sm font-semibold text-primary">Bedrooms</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BEDROOMS.map((b) => (
              <Chip
                key={b}
                label={b === "studio" ? "Studio" : b}
                active={beds === b}
                onClick={() => onBeds(beds === b ? "" : b)}
              />
            ))}
          </div>

          <p className="mt-5 text-sm font-semibold text-primary">Bathrooms</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BATHROOMS.map((b) => (
              <Chip
                key={b}
                label={b}
                active={baths === b}
                onClick={() => onBaths(baths === b ? "" : b)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PropertyFilterBar({ dealType }: { dealType: "rent" | "buy" }) {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<"" | "offplan" | "ready">("");

  function search() {
    // Compose a natural-language query so the existing intent extraction and
    // search pipeline handle the filters — no separate filtered endpoint needed.
    const parts: string[] = [];
    if (beds === "studio") parts.push("studio");
    else if (beds) parts.push(`${beds.replace("+", "")} bed`);
    if (baths) parts.push(`${baths.replace("+", "")} bath`);
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
        <BedsBaths
          beds={beds}
          baths={baths}
          onBeds={setBeds}
          onBaths={setBaths}
        />
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
