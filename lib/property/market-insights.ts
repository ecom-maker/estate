/**
 * Deterministic "market insights" seed data derived from a property's own
 * attributes (price, area, community). Stable per property (seeded by id), so
 * the Transactions and Prices & trends sections always render realistic sample
 * data without extra DB rows.
 */

export type Txn = { date: string; aed: number; area: number };

export type MarketInsights = {
  sold: Txn[];
  rented: Txn[];
  trend: {
    months: string[]; // 60 monthly labels, oldest → newest
    sale: { primary: number[]; secondary: number[] }; // AED / sqft
    rent: { primary: number[]; secondary: number[] }; // AED / sqft / year
    primaryLabel: string;
    secondaryLabel: string;
  };
};

function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function seedFromId(id: string): number {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return Math.abs(n) + 1;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildMarketInsights(p: {
  id: string;
  priceAed: number | null;
  areaSqft: number | null;
  community?: { name: string } | null;
}): MarketInsights {
  const price = p.priceAed ?? 5_000_000;
  const area = p.areaSqft ?? 1500;
  const ppsqft = price / area;
  const rnd = seeded(seedFromId(p.id));
  const jitter = (base: number, pct: number) =>
    base * (1 + (rnd() * 2 - 1) * pct);
  const roundTo = (n: number, step: number) => Math.round(n / step) * step;

  const now = new Date();

  // Recent comparable sales (last ~6 weeks, descending).
  const sold: Txn[] = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (i * 6 + Math.floor(rnd() * 4) + 2));
    const a = Math.round(jitter(area, 0.35));
    return {
      date: fmtDate(d),
      aed: roundTo(a * jitter(ppsqft, 0.12), 50_000),
      area: a,
    };
  });

  // Recent comparable rentals (annual rent ≈ 5–7% gross yield).
  const rented: Txn[] = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (i * 6 + Math.floor(rnd() * 4) + 1));
    const a = Math.round(jitter(area, 0.4));
    const yieldPct = 0.05 + rnd() * 0.02;
    return {
      date: fmtDate(d),
      aed: roundTo(a * ppsqft * yieldPct, 5_000),
      area: a,
    };
  });

  // 60 months of AED/sqft — gentle dip then recovery with slight upward drift.
  const months: string[] = [];
  const primary: number[] = [];
  const secondary: number[] = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    );
    const t = (59 - i) / 59; // 0..1
    const wave = Math.sin(t * Math.PI * 1.6 - 0.5) * 0.06;
    const drift = t * 0.08;
    const noise = (rnd() - 0.5) * 0.02;
    const base = ppsqft * (1 + wave + drift + noise);
    primary.push(Math.round(base));
    secondary.push(Math.round(base * (0.9 + (rnd() - 0.5) * 0.03)));
  }

  // Rent per sqft/year ≈ ~6% gross yield of the sale price per sqft.
  const rentPrimary = primary.map((v) =>
    Math.round(v * (0.06 + (rnd() - 0.5) * 0.004)),
  );
  const rentSecondary = secondary.map((v) =>
    Math.round(v * (0.06 + (rnd() - 0.5) * 0.004)),
  );

  return {
    sold,
    rented,
    trend: {
      months,
      sale: { primary, secondary },
      rent: { primary: rentPrimary, secondary: rentSecondary },
      primaryLabel: p.community?.name ?? "This development",
      secondaryLabel: (() => {
        const name = p.community?.name;
        if (!name) return "Wider area";
        const parts = name.split(" ");
        // Wider area = drop the most specific token, else the city.
        return parts.length > 2 ? parts.slice(0, -1).join(" ") : "Dubai";
      })(),
    },
  };
}
