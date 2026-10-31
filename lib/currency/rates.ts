import "server-only";
import { kvGet, kvSet } from "@/lib/settings/kv";
import { FX_TO_AED } from "@/lib/currency/fx";

/**
 * Live FX rates (AED per unit of each currency), cached in the settings KV for
 * 24h and refreshed on demand. Falls back to the static snapshot in fx.ts when
 * the feed is unreachable. Used only to normalize native prices to AED at
 * ingest (display uses the native amount and needs no conversion).
 */

const CACHE_KEY = "fx_rates";
const TTL_MS = 24 * 60 * 60 * 1000;
// Free, key-less daily rates. Returns { rates: { USD: 0.272, ... } } = units of
// each currency per 1 AED; we invert to get AED per unit.
const FEED = "https://open.er-api.com/v6/latest/AED";

type Cache = { aedPer: Record<string, number>; fetchedAt: number };

async function fetchRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(FEED, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (json.result !== "success" || !json.rates) return null;
    const aedPer: Record<string, number> = { AED: 1 };
    for (const [code, perAed] of Object.entries(json.rates)) {
      if (typeof perAed === "number" && perAed > 0) aedPer[code] = 1 / perAed;
    }
    return aedPer;
  } catch {
    return null;
  }
}

/** AED per one unit of `currency`, from live cache → feed → static snapshot. */
export async function fxToAed(currency: string): Promise<number> {
  const code = currency.toUpperCase();
  if (code === "AED") return 1;

  let cache = await kvGet<Cache | null>(CACHE_KEY, null);
  const stale = !cache || Date.now() - cache.fetchedAt > TTL_MS;

  if (stale) {
    const fresh = await fetchRates();
    if (fresh) {
      cache = { aedPer: fresh, fetchedAt: Date.now() };
      try {
        await kvSet(CACHE_KEY, cache);
      } catch {
        // ignore cache write failures
      }
    }
  }

  return cache?.aedPer[code] ?? FX_TO_AED[code] ?? 1;
}

/** Convert a native amount to AED using live rates (rounded). */
export async function toAedLive(amount: number, currency: string): Promise<number> {
  return Math.round(amount * (await fxToAed(currency)));
}
