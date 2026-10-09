"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import {
  DEFAULT_COUNTRY,
  findCountry,
  flagEmoji,
  searchCountries,
  type Country,
} from "@/lib/phone/countries";
import { cn } from "@/lib/utils";

/** Region from the browser language, e.g. "en-AE" → "AE". */
function browserRegion(): string | null {
  if (typeof navigator === "undefined") return null;
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = lang?.split("-")[1];
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  }
  return null;
}

/**
 * Phone number with a searchable country picker. The default country is the
 * visitor's location (from the server, e.g. Vercel's IP country), else their
 * browser region, else the UAE.
 */
export function PhoneInput({
  defaultCountry,
  country,
  onCountryChange,
  value,
  onChange,
  id = "phone",
}: {
  defaultCountry?: string | null;
  country: Country | null;
  onCountryChange: (c: Country) => void;
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Pick the starting country once, on the client.
  useEffect(() => {
    if (country) return;
    onCountryChange(
      findCountry(defaultCountry) ?? findCountry(browserRegion()) ?? findCountry(DEFAULT_COUNTRY)!,
    );
  }, [country, defaultCountry, onCountryChange]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const results = useMemo(() => searchCountries(query), [query]);

  function choose(c: Country) {
    onCountryChange(c);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      <div
        className={cn(
          "phone-field flex items-center rounded-sm border bg-card transition",
          open ? "border-primary/60" : "border-border focus-within:border-accent",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={country ? `Country: ${country.name} +${country.dial}` : "Choose country"}
          className="flex shrink-0 items-center gap-1.5 py-3 pl-4 pr-3 text-muted"
        >
          <span className="text-xl leading-none" aria-hidden>
            {country ? flagEmoji(country.iso) : "🌐"}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="h-7 w-px bg-border" aria-hidden />
        <span className="pl-3 text-sm text-muted">{country ? `+${country.dial}` : ""}</span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="50 000 0000"
          aria-label="Phone number"
          className="min-w-0 flex-1 bg-transparent py-3 pl-2 pr-4 text-sm text-primary outline-none"
          required
        />
      </div>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-sm border border-border bg-card shadow-lg">
          <label className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="h-4 w-4 text-muted" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              aria-label="Search country or code"
              className="w-full bg-transparent text-sm text-primary outline-none"
            />
          </label>
          <ul role="listbox" aria-label="Countries" className="max-h-64 overflow-y-auto py-1">
            {results.map((c) => (
              <li key={c.iso} role="option" aria-selected={country?.iso === c.iso}>
                <button
                  type="button"
                  onClick={() => choose(c)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-accent/10",
                    country?.iso === c.iso && "bg-accent/10",
                  )}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {flagEmoji(c.iso)}
                  </span>
                  <span className="flex-1 text-primary">{c.name}</span>
                  <span className="text-muted">+{c.dial}</span>
                </button>
              </li>
            ))}
            {!results.length ? <li className="px-3 py-3 text-sm text-muted">No matches</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
