/**
 * Bedroom figures for display.
 *
 * Off-plan projects imported from Reelly hold several unit types (e.g. 1, 2
 * and 3 bed), but `property.bedrooms` is one number. The import stores the
 * LARGEST type there so a "3+ bed" search still finds a 1–3 bed tower, while
 * `priceAed` and `areaSqft` are the project's STARTING figures (its smallest,
 * cheapest unit). Printing `bedrooms` beside the price therefore paired a
 * 3-bed count with a 1-bed price. Anything that shows bedrooms to a visitor
 * goes through here instead, so it shows the real span ("1 – 3").
 */

type BedSource = {
  bedrooms: number | null;
  priceAed?: number | null;
  units?: { bedrooms: number | null }[] | null;
  metadata?: unknown;
};

type ReellyMeta = {
  minBedrooms?: unknown;
  maxBedrooms?: unknown;
  maxPriceAed?: unknown;
};

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Smallest and largest bedroom count on offer. Prefers the unit rows (what
 * the Units section shows), then Reelly's project min/max, then the single
 * stored figure. Reelly sometimes uses halves (3.5 = 3 bed + maid's room);
 * those are floored, the same way unit rows are imported.
 */
export function bedroomSpan(p: BedSource): { min: number; max: number } | null {
  const fromUnits = (p.units ?? [])
    .map((u) => u.bedrooms)
    .filter((b): b is number => b != null);
  if (fromUnits.length) {
    return { min: Math.min(...fromUnits), max: Math.max(...fromUnits) };
  }
  const meta = (p.metadata ?? {}) as ReellyMeta;
  const lo = num(meta.minBedrooms);
  const hi = num(meta.maxBedrooms);
  if (lo != null && hi != null) {
    const a = Math.floor(lo);
    const b = Math.floor(hi);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return p.bedrooms != null ? { min: p.bedrooms, max: p.bedrooms } : null;
}

const token = (n: number) => (n === 0 ? "Studio" : String(n));

/** "1 – 3", "Studio – 2", "2", "Studio" — for a labelled "Bedrooms" field. */
export function bedroomsValue(p: BedSource): string | null {
  const s = bedroomSpan(p);
  if (!s) return null;
  return s.min === s.max ? token(s.min) : `${token(s.min)} – ${s.max}`;
}

/** "1 – 3 beds", "Studio – 2 beds", "1 bed", "Studio" — for cards and sentences. */
export function bedroomsText(p: BedSource): string | null {
  const s = bedroomSpan(p);
  if (!s) return null;
  if (s.min === s.max) {
    return s.min === 0 ? "Studio" : `${s.min} ${s.min === 1 ? "bed" : "beds"}`;
  }
  return `${token(s.min)} – ${s.max} ${s.max === 1 ? "bed" : "beds"}`;
}

/**
 * True when the stored price/area are a project's starting figures rather
 * than one unit's — several bedroom types, or a recorded top price above the
 * stored one. Callers prefix "from" in that case.
 */
export function isStartingFigure(p: BedSource): boolean {
  const s = bedroomSpan(p);
  if (s && s.min !== s.max) return true;
  const maxPrice = num(((p.metadata ?? {}) as ReellyMeta).maxPriceAed);
  return maxPrice != null && p.priceAed != null && maxPrice > p.priceAed;
}
