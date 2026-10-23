"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/components/auth/sign-in-gate";
import type { Place } from "@/app/api/places/route";
import {
  BATHROOMS,
  BEDROOMS,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  FURNISHING_OPTIONS,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  hasUnitFilters,
  unitFiltersToSearch,
  type Furnishing,
  type Sort,
  type UnitFilters,
} from "@/lib/search/unit-filters";

const TYPE_PREVIEW = 6; // shown before "View more"

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
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-[360px] max-w-[85vw] overflow-y-auto overscroll-contain rounded-md border border-border bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
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
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-[320px] max-w-[80vw] overflow-y-auto overscroll-contain rounded-md border border-border bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
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
  onCommit,
}: {
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  onCommit?: () => void;
}) {
  const { open, setOpen, ref } = usePopover();
  // Price is free text, so it applies when the popover closes (click-away or
  // Search), not on every keystroke.
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) commitRef.current?.();
    wasOpen.current = open;
  }, [open]);

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
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-[340px] max-w-[80vw] overflow-y-auto overscroll-contain rounded-md border border-border bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
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

/**
 * The "Filters" menu groups the less-common filters behind one trigger, with
 * room to grow. Furnishing is the first group; add new sections here as they
 * come. The trigger shows how many of these filters are active.
 */
function FiltersMenu({
  furnishing,
  onFurnishing,
}: {
  furnishing: Furnishing;
  onFurnishing: (v: Furnishing) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const activeCount = furnishing ? 1 : 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-white py-2 pl-4 pr-3 text-sm transition focus:border-accent",
          activeCount > 0 ? "text-accent" : "text-primary/70",
        )}
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
        <span>Filters</span>
        {activeCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-white">
            {activeCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-[340px] max-w-[85vw] overflow-y-auto overscroll-contain rounded-md border border-border bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
          <p className="text-sm font-semibold text-primary">Furnishing</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FURNISHING_OPTIONS.map((o) => (
              <Chip
                key={o.value || "all"}
                label={o.label}
                active={furnishing === o.value}
                onClick={() => onFurnishing(o.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sort control for the unit list. Single-select (radio), applied immediately on
 * choice — the expected behaviour for a sort menu, unlike the filters which
 * apply on Search.
 */
function SortMenu({
  sort,
  onSort,
}: {
  sort: Sort;
  onSort: (v: Sort) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const current = SORT_OPTIONS.find((o) => o.value === sort);
  const active = sort !== DEFAULT_SORT;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-white py-2 pl-4 pr-3 text-sm transition focus:border-accent",
          active ? "text-accent" : "text-primary/70",
        )}
      >
        <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden />
        <span>{active ? current?.label : "Sort"}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="radiogroup"
          aria-label="Sort"
          className="absolute left-0 top-full z-50 mt-2 w-[220px] max-w-[80vw] overflow-hidden rounded-md border border-border bg-white py-1 shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
        >
          {SORT_OPTIONS.map((o) => {
            const selected = o.value === sort;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  onSort(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-accent/5",
                  selected ? "text-accent" : "text-primary/80",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-accent" : "border-muted",
                  )}
                  aria-hidden
                >
                  {selected ? (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  ) : null}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function PropertyFilterBar({
  dealType = "buy",
  showDeal = false,
  mode = "search",
  initial = EMPTY_FILTERS,
  sort: initialSort = DEFAULT_SORT,
}: {
  dealType?: "rent" | "buy";
  showDeal?: boolean;
  /**
   * "search": AI search on /search (sign-in gated).
   * "listing": plain filters on the /properties unit list, no AI.
   */
  mode?: "search" | "listing";
  initial?: UnitFilters;
  sort?: Sort;
}) {
  const router = useRouter();
  // Results open only for signed-in visitors (agents and automation skip this).
  const requireAuth = useRequireAuth();
  const [dealState, setDealState] = useState<"rent" | "buy">(dealType);
  const deal = showDeal ? dealState : dealType;
  const [city, setCity] = useState(initial.q);
  const [typeLabels, setTypeLabels] = useState<string[]>(initial.types);
  const [beds, setBeds] = useState<string[]>(initial.beds);
  const [baths, setBaths] = useState<string[]>(initial.baths);
  const [minPrice, setMinPrice] = useState(initial.min);
  const [maxPrice, setMaxPrice] = useState(initial.max);
  const [status, setStatus] = useState<"" | "offplan" | "ready">(initial.status);
  const [furnishing, setFurnishing] = useState<Furnishing>(initial.furnishing);
  const [sort, setSort] = useState<Sort>(initialSort);
  const listing = mode === "listing";

  // Autocomplete for the city/community/building field, loaded from the DB.
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/places");
        const json = await res.json();
        if (!cancelled && json?.success) setPlaces(json.data.places as Place[]);
      } catch {
        // No suggestions — the field still works as free text.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!placesOpen) return;
    function onDocClick(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setPlacesOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [placesOpen]);

  const suggestions = useMemo(() => {
    const text = city.trim().toLowerCase();
    const matches = text
      ? places.filter((p) => p.label.toLowerCase().includes(text))
      : places;
    return matches.slice(0, 8);
  }, [city, places]);

  function search(cityOverride?: string) {
    const cityVal = cityOverride ?? city;
    if (listing) {
      // Plain database filters on the unit list (no AI).
      const qs = unitFiltersToSearch({
        q: cityVal,
        types: typeLabels,
        beds,
        baths,
        min: minPrice,
        max: maxPrice,
        status,
        furnishing,
      });
      const params = new URLSearchParams(qs);
      if (deal === "rent") params.set("deal", "rent");
      if (sort !== DEFAULT_SORT) params.set("sort", sort);
      const s = params.toString();
      // Keep the scroll position — the bar is sticky and the user is filtering.
      router.push(s ? `/properties?${s}` : "/properties", { scroll: false });
      return;
    }

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

    if (cityVal.trim()) parts.push(`in ${cityVal.trim()}`);
    if (status === "offplan") parts.push("off-plan");
    if (status === "ready") parts.push("ready");
    if (furnishing === "furnished") parts.push("furnished");
    else if (furnishing === "unfurnished") parts.push("unfurnished");
    else if (furnishing === "partly") parts.push("semi furnished");

    const minP = Number(minPrice.replace(/,/g, ""));
    const maxP = Number(maxPrice.replace(/,/g, ""));
    if (minPrice && Number.isFinite(minP) && minP > 0)
      parts.push(`over AED ${minP}`);
    if (maxPrice && Number.isFinite(maxP) && maxP > 0)
      parts.push(`under AED ${maxP}`);

    parts.push(deal === "rent" ? "for rent" : "for sale");
    const q = parts.join(" ");
    const url = `/search?${new URLSearchParams({ q }).toString()}`;
    void requireAuth(() => router.push(url), { next: url });
  }

  // Signature of what's currently selected vs. what the URL reflects.
  const currentSig = `${unitFiltersToSearch({
    q: city,
    types: typeLabels,
    beds,
    baths,
    min: minPrice,
    max: maxPrice,
    status,
    furnishing,
  })}|${sort}`;
  const initialSig = `${unitFiltersToSearch(initial)}|${initialSort}`;
  // Changes to discrete controls (type, beds, baths, status, furnishing, sort)
  // apply right away; free-text city/price don't auto-fire on every keystroke.
  const discreteSig = JSON.stringify([
    typeLabels,
    beds,
    baths,
    status,
    furnishing,
    sort,
  ]);

  // Adopt the URL when it changes from outside this component — the Clear
  // button, browser back/forward, or the server echoing our own push. The bar
  // isn't remounted, so open popovers stay open.
  useEffect(() => {
    setCity(initial.q);
    setTypeLabels(initial.types);
    setBeds(initial.beds);
    setBaths(initial.baths);
    setMinPrice(initial.min);
    setMaxPrice(initial.max);
    setStatus(initial.status);
    setFurnishing(initial.furnishing);
    setSort(initialSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSig]);

  // Selecting a discrete filter runs the search immediately (listing only).
  useEffect(() => {
    if (!listing) return;
    if (currentSig === initialSig) return; // already reflects the URL
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discreteSig]);

  return (
    <div className="rounded-sm border border-white/15 bg-white/95 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.35)] backdrop-blur">
      <div ref={cityRef} className="relative">
        <div className="flex items-center gap-3 border-b border-border px-1 pb-3">
          <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          <label htmlFor="filter-city" className="sr-only">
            City, community or building
          </label>
          <input
            id="filter-city"
            role="combobox"
            aria-expanded={placesOpen && suggestions.length > 0}
            aria-controls="filter-city-list"
            aria-autocomplete="list"
            autoComplete="off"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPlacesOpen(true);
              setHighlight(-1);
            }}
            onFocus={() => setPlacesOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && suggestions.length) {
                e.preventDefault();
                setPlacesOpen(true);
                setHighlight((h) => (h + 1) % suggestions.length);
              } else if (e.key === "ArrowUp" && suggestions.length) {
                e.preventDefault();
                setHighlight((h) =>
                  h <= 0 ? suggestions.length - 1 : h - 1,
                );
              } else if (e.key === "Enter") {
                if (placesOpen && highlight >= 0 && suggestions[highlight]) {
                  e.preventDefault();
                  const label = suggestions[highlight].label;
                  setCity(label);
                  setPlacesOpen(false);
                  setHighlight(-1);
                  // Selecting a suggestion runs the search right away.
                  search(label);
                } else {
                  search();
                }
              } else if (e.key === "Escape") {
                setPlacesOpen(false);
                setHighlight(-1);
              }
            }}
            placeholder="City, community or building"
            className="w-full bg-transparent text-base text-primary outline-none placeholder:text-muted"
          />
        </div>
        {placesOpen && suggestions.length ? (
          <ul
            id="filter-city-list"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-md border border-border bg-white py-1 shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
          >
            {suggestions.map((p, i) => (
              <li key={`${p.kind}:${p.label}`} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    setCity(p.label);
                    setPlacesOpen(false);
                    setHighlight(-1);
                    // Selecting a suggestion runs the search right away.
                    search(p.label);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition",
                    i === highlight ? "bg-accent/10 text-accent" : "text-primary/80",
                  )}
                >
                  <span className="truncate">{p.label}</span>
                  <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted">
                    {p.kind}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
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
          onCommit={() => {
            if (listing && currentSig !== initialSig) search();
          }}
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

        <FiltersMenu furnishing={furnishing} onFurnishing={setFurnishing} />

        {listing ? <SortMenu sort={sort} onSort={setSort} /> : null}

        {listing && hasUnitFilters(initial) ? (
          <button
            type="button"
            onClick={() => router.push("/properties")}
            className="ml-auto text-sm font-medium text-muted transition hover:text-primary"
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => search()}
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
            !(listing && hasUnitFilters(initial)) && "ml-auto",
          )}
        >
          <Search className="h-4 w-4" aria-hidden />
          Search
        </button>
      </div>
    </div>
  );
}
