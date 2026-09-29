"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Rich label list (from the reference) → the app's 6 base types for filtering.
const TYPE_OPTIONS: { label: string; type: string }[] = [
  { label: "Apartment", type: "apartment" },
  { label: "Villa", type: "villa" },
  { label: "Townhouse", type: "townhouse" },
  { label: "Penthouse", type: "penthouse" },
  { label: "Compound", type: "villa" },
  { label: "Duplex", type: "apartment" },
  { label: "Full Floor", type: "unit" },
  { label: "Half Floor", type: "unit" },
  { label: "Whole Building", type: "unit" },
  { label: "Land", type: "land" },
  { label: "Bulk Sale Unit", type: "unit" },
  { label: "Bungalow", type: "villa" },
  { label: "Hotel & Hotel Apartment", type: "unit" },
];
const TYPE_PREVIEW = 6; // shown before "View more"

const BEDROOMS = ["studio", "1", "2", "3", "4", "5", "6", "7", "7+"];
const BATHROOMS = ["1", "2", "3", "4", "5", "6", "7", "7+"];

function compactAED(value: string): string {
  const n = Number(value.replace(/,/g, ""));
  if (!value || !Number.isFinite(n) || n <= 0) return "";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `AED ${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`;
  return `AED ${n}`;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function usePopover() {
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
  return { open, setOpen, ref };
}

function TriggerPill({
  label,
  active,
  open,
  onClick,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-[15rem] items-center gap-2 truncate rounded-full border border-border bg-white py-2 pl-4 pr-3 text-sm transition focus:border-accent",
        active ? "text-accent" : "text-primary/70",
      )}
    >
      <span className="truncate">{label}</span>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted transition-transform",
          open && "rotate-180",
        )}
        aria-hidden
      />
    </button>
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
        "rounded-full border px-4 py-2 text-sm transition",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-primary/80 hover:border-accent/60",
      )}
    >
      {label}
    </button>
  );
}

function PropertyTypeSelect({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (label: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? TYPE_OPTIONS : TYPE_OPTIONS.slice(0, TYPE_PREVIEW);

  const label =
    selected.length === 0
      ? "Property type"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} types`;

  return (
    <div ref={ref} className="relative">
      <TriggerPill
        label={label}
        active={selected.length > 0}
        open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[360px] max-w-[85vw] rounded-md border border-border bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
          <div className="flex flex-wrap gap-2">
            {visible.map((o) => (
              <Chip
                key={o.label}
                label={o.label}
                active={selected.includes(o.label)}
                onClick={() => onToggle(o.label)}
              />
            ))}
          </div>
          {TYPE_OPTIONS.length > TYPE_PREVIEW ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-4 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/5"
            >
              {expanded ? "View less" : "View more"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BedsBaths({
  beds,
  baths,
  onBed,
  onBath,
}: {
  beds: string[];
  baths: string[];
  onBed: (v: string) => void;
  onBath: (v: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();

  const label = (() => {
    const b = beds.length
      ? `${beds.map((x) => (x === "studio" ? "Studio" : x)).join(", ")} Bed`
      : "";
    const ba = baths.length ? `${baths.join(", ")} Bath` : "";
    if (b && ba) return `${b} · ${ba}`;
    return b || ba || "Beds & Baths";
  })();

  return (
    <div ref={ref} className="relative">
      <TriggerPill
        label={label}
        active={beds.length > 0 || baths.length > 0}
        open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[320px] max-w-[80vw] rounded-md border border-border bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
          <p className="text-sm font-semibold text-primary">Bedrooms</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BEDROOMS.map((b) => (
              <Chip
                key={b}
                label={b === "studio" ? "Studio" : b}
                active={beds.includes(b)}
                onClick={() => onBed(b)}
              />
            ))}
          </div>
          <p className="mt-5 text-sm font-semibold text-primary">Bathrooms</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BATHROOMS.map((b) => (
              <Chip
                key={b}
                label={b}
                active={baths.includes(b)}
                onClick={() => onBath(b)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PriceRange({
  min,
  max,
  onMin,
  onMax,
}: {
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();

  const label = (() => {
    const lo = compactAED(min);
    const hi = compactAED(max);
    if (lo && hi) return `${lo} – ${hi}`;
    if (lo) return `${lo}+`;
    if (hi) return `Up to ${hi}`;
    return "Price";
  })();

  const inputClass =
    "w-full rounded-md border border-border px-3 py-2.5 text-sm text-primary outline-none transition placeholder:text-muted focus:border-accent";

  return (
    <div ref={ref} className="relative">
      <TriggerPill
        label={label}
        active={Boolean(min || max)}
        open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[340px] max-w-[80vw] rounded-md border border-border bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
          <p className="text-sm font-semibold text-primary">Price</p>
          <div className="mt-3 flex items-center gap-3">
            <label htmlFor="price-min" className="sr-only">
              Minimum price in AED
            </label>
            <input
              id="price-min"
              inputMode="numeric"
              value={min}
              onChange={(e) => onMin(e.target.value.replace(/[^\d,]/g, ""))}
              placeholder="Min. Price (AED)"
              className={inputClass}
            />
            <span className="text-muted" aria-hidden>
              —
            </span>
            <label htmlFor="price-max" className="sr-only">
              Maximum price in AED
            </label>
            <input
              id="price-max"
              inputMode="numeric"
              value={max}
              onChange={(e) => onMax(e.target.value.replace(/[^\d,]/g, ""))}
              placeholder="Max. Price (AED)"
              className={inputClass}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PropertyFilterBar({
  dealType = "buy",
  showDeal = false,
}: {
  dealType?: "rent" | "buy";
  showDeal?: boolean;
}) {
  const router = useRouter();
  const [dealState, setDealState] = useState<"rent" | "buy">(dealType);
  const deal = showDeal ? dealState : dealType;
  const [city, setCity] = useState("");
  const [typeLabels, setTypeLabels] = useState<string[]>([]);
  const [beds, setBeds] = useState<string[]>([]);
  const [baths, setBaths] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [status, setStatus] = useState<"" | "offplan" | "ready">("");

  function search() {
    // Compose a natural-language query so the existing intent extraction and
    // search pipeline handle the filters — no separate filtered endpoint needed.
    const parts: string[] = [];

    for (const b of beds) {
      if (b === "studio") parts.push("studio");
      else parts.push(`${b.replace("+", "")} bed`);
    }
    for (const b of baths) parts.push(`${b.replace("+", "")} bath`);

    const types = [
      ...new Set(
        typeLabels
          .map((l) => TYPE_OPTIONS.find((o) => o.label === l)?.type)
          .filter((t): t is string => Boolean(t)),
      ),
    ];
    if (types.length) parts.push(...types);
    else parts.push("property");

    if (city.trim()) parts.push(`in ${city.trim()}`);
    if (status === "offplan") parts.push("off-plan");
    if (status === "ready") parts.push("ready");

    const minP = Number(minPrice.replace(/,/g, ""));
    const maxP = Number(maxPrice.replace(/,/g, ""));
    if (minPrice && Number.isFinite(minP) && minP > 0)
      parts.push(`over AED ${minP}`);
    if (maxPrice && Number.isFinite(maxP) && maxP > 0)
      parts.push(`under AED ${maxP}`);

    parts.push(deal === "rent" ? "for rent" : "for sale");
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
        {showDeal ? (
          <div className="relative">
            <select
              value={dealState}
              onChange={(e) => setDealState(e.target.value as "rent" | "buy")}
              aria-label="Buy or rent"
              className="cursor-pointer appearance-none rounded-full border border-border bg-white py-2 pl-4 pr-9 text-sm font-medium text-accent outline-none transition focus:border-accent"
            >
              <option value="buy">Buy</option>
              <option value="rent">Rent</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
          </div>
        ) : null}
        <PropertyTypeSelect
          selected={typeLabels}
          onToggle={(l) => setTypeLabels((s) => toggle(s, l))}
        />
        <BedsBaths
          beds={beds}
          baths={baths}
          onBed={(v) => setBeds((s) => toggle(s, v))}
          onBath={(v) => setBaths((s) => toggle(s, v))}
        />
        <PriceRange
          min={minPrice}
          max={maxPrice}
          onMin={setMinPrice}
          onMax={setMaxPrice}
        />

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
