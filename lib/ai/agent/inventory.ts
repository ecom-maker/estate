import { descriptionSections, highlightList } from "@/lib/property/description";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { SITE_URL } from "@/lib/data-layer/canonical";
import { unitListing } from "@/lib/property/deal";

/**
 * Inventory reads for the AI sales agent. Every fact the agent may state comes
 * from here, so the shapes are explicit about what is NOT on file (null) and
 * never fill gaps with defaults.
 *
 * Off-plan projects (the Reelly feed) store a "from" price and the MAX bedroom
 * count on the property row; the real per-bedroom prices live in the unit
 * types (`property_units`, e.g. "2BR" from AED X to AED Y). Matching on the
 * unit types is what lets "2 bed under 2M" find a project whose 1-beds start
 * at 900k but whose 2-beds start at 1.8M — and quote the 2-bed price.
 */

export const agentInclude = {
  community: true,
  developer: true,
  units: true,
  documents: true,
  amenities: { include: { amenity: true } },
} satisfies Prisma.PropertyInclude;

export type AgentProperty = Prisma.PropertyGetPayload<{
  include: typeof agentInclude;
}>;

type PlanStep = { name?: string; percentage?: number };
type ProjectMeta = {
  dealType?: string;
  district?: string;
  unitTypes?: string[];
  minBedrooms?: number | null;
  maxBedrooms?: number | null;
  maxPriceAed?: number | null;
  maxSizeSqft?: number | null;
  handoverDate?: string | null;
  completionLabel?: string | null;
  constructionStatus?: string | null;
  readinessProgress?: number | null;
  saleStatus?: string | null;
  serviceCharge?: string | null;
  furnishing?: string | null;
  escrowNumber?: string | null;
  postHandover?: boolean;
  allPaymentPlans?: {
    name?: string;
    steps?: PlanStep[];
    months_after_handover?: number | null;
  }[];
};
type UnitMeta = { to_price_aed?: number; to_size_sqft?: number };

const meta = (p: { metadata: unknown }) => (p.metadata ?? {}) as ProjectMeta;
/** Zero means "unknown" in the feed (sold-out projects carry price 0). */
const pos = (n: number | null | undefined) => (n != null && n > 0 ? n : null);

export function aed(n: number | null | undefined): string | null {
  const v = pos(n);
  return v == null ? null : `AED ${Math.round(v).toLocaleString("en-US")}`;
}
const sqft = (n: number | null | undefined) =>
  pos(n) == null ? null : `${Math.round(n!).toLocaleString("en-US")} sqft`;

export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const STOP = new Set(["the", "in", "at", "area", "areas", "near", "of", "and", "community", "uae"]);

/**
 * True when every meaningful word of `term` appears in `text`, allowing one
 * typo per word of 5+ letters ("jumeira" → "jumeirah", "marna" → "marina").
 */
export function fuzzyPhrase(text: string, term: string): boolean {
  const t = norm(term);
  const h = norm(text);
  if (!t || !h) return false;
  if (h.includes(t)) return true;
  const words = h.split(" ");
  const tokens = t.split(" ").filter((w) => w && !STOP.has(w));
  if (!tokens.length) return false;
  return tokens.every((tok) =>
    words.some(
      (w) => w === tok || (tok.length >= 5 && w.length >= 4 && levenshtein(w, tok) <= 1),
    ),
  );
}

/** The fields the name / area / type / completion checks read. A full row and
 *  a light index row both have them, so one set of checks serves both. */
type Listing = {
  title: string;
  type: string;
  offPlan: boolean;
  metadata: unknown;
  community: { name: string; emirate: string | null; city: string | null } | null;
  developer: { name: string } | null;
};

export function projectUrl(p: { slug: string; source: string | null; offPlan: boolean; units?: unknown[] }) {
  const isProject = p.source === "reelly" || p.offPlan || (p.units?.length ?? 0) > 0;
  // Customer-facing share links must use the canonical public domain (same as
  // sitemap/metadata), not getAppUrl() — which tracks the auth/app URL and can
  // point at a stale preview deployment.
  return `${SITE_URL}/${isProject ? "projects" : "properties"}/${p.slug}`;
}

/** Location matching uses the community, its emirate and the project district —
 *  never the description or the feed's "sector", which name-drop nearby areas. */
export function matchesLocation(p: Listing, term: string): boolean {
  const fields = [p.community?.name, p.community?.emirate, p.community?.city, meta(p).district, p.title];
  return fields.some((f) => f && fuzzyPhrase(f, term));
}

function propertyTypes(p: Listing): string[] {
  const types = new Set<string>([p.type.toLowerCase()]);
  for (const t of meta(p).unitTypes ?? []) {
    const n = norm(t).replace(/s$/, "");
    if (n) types.add(n === "apartment" ? "apartment" : n);
  }
  return [...types];
}

export type UnitType = {
  unit: string;
  bedrooms: number | null;
  bathrooms: number | null;
  priceFromAed: number | null;
  priceToAed: number | null;
  sizeFromSqft: number | null;
  sizeToSqft: number | null;
  status: string | null;
};

export function unitTypes(p: AgentProperty): UnitType[] {
  return p.units
    .filter((u) => !(u as { hidden?: boolean }).hidden)
    .map((u) => {
      const m = (u.metadata ?? {}) as UnitMeta;
      return {
        unit: u.unitNumber,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        priceFromAed: pos(u.priceAed),
        priceToAed: pos(m.to_price_aed) ?? pos(u.priceAed),
        sizeFromSqft: pos(u.areaSqft),
        sizeToSqft: pos(m.to_size_sqft) ?? pos(u.areaSqft),
        status: u.status,
      };
    })
    .sort((a, b) => (a.bedrooms ?? 99) - (b.bedrooms ?? 99) || (a.priceFromAed ?? 0) - (b.priceFromAed ?? 0));
}

function bedLabel(b: number | null) {
  return b == null ? "unit" : b === 0 ? "Studio" : `${b}BR`;
}

/** "2BR: from AED 1,844,888 to AED 2,931,888 · 708–1,200 sqft · available" */
export function describeUnit(u: UnitType): string {
  const price =
    u.priceFromAed == null
      ? "price not on file"
      : u.priceToAed && u.priceToAed > u.priceFromAed
        ? `from ${aed(u.priceFromAed)} to ${aed(u.priceToAed)}`
        : `from ${aed(u.priceFromAed)}`;
  const size =
    u.sizeFromSqft == null
      ? null
      : u.sizeToSqft && u.sizeToSqft > u.sizeFromSqft
        ? `${Math.round(u.sizeFromSqft).toLocaleString("en-US")}–${sqft(u.sizeToSqft)}`
        : sqft(u.sizeFromSqft);
  const baths = u.bathrooms != null ? `${u.bathrooms} bath` : null;
  // Unit numbers are admin-only — never surface them to the assistant/customers.
  return [`${bedLabel(u.bedrooms)}: ${price}`, size, baths, u.status].filter(Boolean).join(" · ");
}

export type BedroomGroup = { bedrooms: number | null; options: UnitType[] };

/** Feeds list many rows per bedroom count (Eleve: 34 two-beds) — group them. */
export function groupByBedrooms(units: UnitType[]): BedroomGroup[] {
  const groups = new Map<string, BedroomGroup>();
  for (const u of units) {
    const key = String(u.bedrooms);
    const g = groups.get(key) ?? { bedrooms: u.bedrooms, options: [] };
    g.options.push(u);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** "2BR: 34 options from AED 1,446,385 to AED 2,931,888 · 1,072–1,400 sqft · 34 showing available" */
export function describeGroup(g: BedroomGroup): string {
  if (g.options.length === 1) return describeUnit(g.options[0]);
  const prices = g.options.flatMap((u) => [u.priceFromAed, u.priceToAed]).filter((n): n is number => n != null);
  const sizes = g.options.flatMap((u) => [u.sizeFromSqft, u.sizeToSqft]).filter((n): n is number => n != null);
  const baths = [...new Set(g.options.map((u) => u.bathrooms).filter((b) => b != null))];
  const available = g.options.filter((u) => u.status === "available").length;
  const lo = prices.length ? Math.min(...prices) : null;
  const hi = prices.length ? Math.max(...prices) : null;
  return [
    `${bedLabel(g.bedrooms)}: ${g.options.length} options ${lo == null ? "(price not on file)" : hi! > lo ? `from ${aed(lo)} to ${aed(hi)}` : `at ${aed(lo)}`}`,
    sizes.length ? `${Math.round(Math.min(...sizes)).toLocaleString("en-US")}–${sqft(Math.max(...sizes))}` : null,
    baths.length ? `${baths.join("/")} bath` : null,
    `${available} of ${g.options.length} showing available`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function planText(steps: PlanStep[] | undefined, monthsAfter?: number | null): string | null {
  const parts = (steps ?? [])
    .filter((s) => s.percentage != null && s.percentage > 0)
    .map((s) => `${Math.round(s.percentage! * 100) / 100}% ${(s.name ?? "").toLowerCase()}`);
  if (!parts.length) return null;
  return parts.join(", ") + (monthsAfter ? ` (post-handover over ${monthsAfter} months)` : "");
}

export function paymentPlans(p: AgentProperty): { name: string; schedule: string }[] {
  const all = meta(p).allPaymentPlans ?? [];
  const plans = all
    .map((pl) => ({ name: pl.name ?? "Payment plan", schedule: planText(pl.steps, pl.months_after_handover) }))
    .filter((x): x is { name: string; schedule: string } => Boolean(x.schedule));
  if (plans.length) return plans;
  // Older rows only carry the summary split.
  const pp = (p.paymentPlan ?? null) as {
    planName?: string;
    downPaymentPct?: number;
    duringConstructionPct?: number;
    onHandoverPct?: number;
    postHandoverPct?: number;
  } | null;
  if (!pp || pp.downPaymentPct == null) return [];
  const steps = [
    { name: "on booking", percentage: pp.downPaymentPct },
    { name: "during construction", percentage: pp.duringConstructionPct },
    { name: "on handover", percentage: pp.onHandoverPct },
    { name: "post-handover", percentage: pp.postHandoverPct },
  ];
  const schedule = planText(steps);
  return schedule ? [{ name: pp.planName ?? "Payment plan", schedule }] : [];
}

function completion(p: Pick<Listing, "offPlan" | "metadata">) {
  const m = meta(p);
  const status = m.constructionStatus ?? (p.offPlan ? "under_construction" : null);
  const ready = status === "completed" || (!p.offPlan && status == null);
  return {
    ready,
    status: ready ? "ready / completed" : status ? status.replace(/_/g, " ") : "not on file",
    handover: m.completionLabel?.trim() || m.handoverDate || null,
    handoverDate: m.handoverDate ?? null,
    constructionProgressPct: m.readinessProgress != null && m.readinessProgress > 0 ? m.readinessProgress : null,
  };
}

/** Properties the agent may offer: live, not sold, not withdrawn. */
const LIVE: Prisma.PropertyWhereInput = { deletedAt: null, status: { in: ["ACTIVE", "RESERVED"] } };

/**
 * A light row per live property: names, area, type and completion only, with
 * no units, documents or text. ~0.3 MB for ~930 properties (the full rows are
 * ~10 MB), so every property can take part in name and area matching — with
 * typo tolerance, which a plain SQL "contains" can't give. Prices, bedrooms
 * and sizes are filtered by the database instead (see unitWhere).
 */
export type IndexRow = Listing & { id: string; slug: string; priceAed: number | null; waterfront: boolean };

type IndexSqlRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  offPlan: boolean;
  priceAed: number | null;
  waterfront: boolean;
  metadata: unknown;
  communityName: string | null;
  emirate: string | null;
  city: string | null;
  developerName: string | null;
};

/**
 * Cached per server instance for a short while: the database can be far from
 * the functions (Singapore DB, US functions), and listings change rarely.
 * Edits and syncs show up within INDEX_TTL_MS; full rows are always read fresh.
 */
const INDEX_TTL_MS = 120_000;
let indexCache: { at: number; rows: Promise<IndexRow[]> } | null = null;

export function loadIndex(): Promise<IndexRow[]> {
  if (!indexCache || Date.now() - indexCache.at > INDEX_TTL_MS) {
    // Only the metadata keys the checks read (meta(): district, unitTypes,
    // completion fields) — the whole column is ~2 KB per property.
    const rows = prisma.$queryRaw<IndexSqlRow[]>`
      SELECT p.id, p.slug, p.title, p.type::text AS type, p.off_plan AS "offPlan",
             p.price_aed AS "priceAed", p.waterfront,
             jsonb_strip_nulls(jsonb_build_object(
               'district', p.metadata_json->'district',
               'unitTypes', p.metadata_json->'unitTypes',
               'constructionStatus', p.metadata_json->'constructionStatus',
               'handoverDate', p.metadata_json->'handoverDate',
               'completionLabel', p.metadata_json->'completionLabel',
               'readinessProgress', p.metadata_json->'readinessProgress'
             )) AS metadata,
             c.name AS "communityName", c.emirate, c.city, d.name AS "developerName"
      FROM properties p
      LEFT JOIN communities c ON c.id = p.community_id
      LEFT JOIN developers d ON d.id = p.developer_id
      WHERE p.deleted_at IS NULL AND p.status IN ('ACTIVE', 'RESERVED')
      ORDER BY p.updated_at DESC
    `.then((list) =>
      list.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        type: r.type,
        offPlan: r.offPlan,
        priceAed: r.priceAed,
        waterfront: r.waterfront,
        metadata: r.metadata,
        community: r.communityName ? { name: r.communityName, emirate: r.emirate, city: r.city } : null,
        developer: r.developerName ? { name: r.developerName } : null,
      })),
    );
    indexCache = { at: Date.now(), rows };
    // A failed load must not be served from the cache.
    rows.catch(() => {
      indexCache = null;
    });
  }
  return indexCache.rows;
}

/**
 * Full rows by id, in the order given. A full read costs one database round
 * trip per relation (~7), which adds up with the DB far from the functions, so
 * rows read in the last ROW_TTL_MS are reused: a search, then "tell me about
 * the second one", reads that property once. Only rows actually searched or
 * asked about are kept — never the whole inventory.
 */
const ROW_TTL_MS = 120_000;
const rowCache = new Map<string, { at: number; row: AgentProperty }>();

async function fullRows(ids: string[]): Promise<AgentProperty[]> {
  const now = Date.now();
  const fresh = (id: string) => {
    const hit = rowCache.get(id);
    return hit && now - hit.at <= ROW_TTL_MS ? hit.row : null;
  };
  const missing = ids.filter((id) => !fresh(id));
  if (missing.length) {
    const rows = await prisma.property.findMany({
      where: { id: { in: missing }, deletedAt: null },
      include: agentInclude,
    });
    for (const row of rows) rowCache.set(row.id, { at: now, row });
  }
  if (rowCache.size > 2000) {
    for (const [id, hit] of rowCache) if (now - hit.at > ROW_TTL_MS) rowCache.delete(id);
  }
  return ids.map((id) => rowCache.get(id)?.row).filter((r): r is AgentProperty => r != null);
}

// ---------------------------------------------------------------- search

export type SearchCriteria = {
  locations?: string[];
  developer?: string;
  propertyTypes?: string[];
  bedrooms?: number[];
  minBedrooms?: number;
  minPriceAed?: number;
  maxPriceAed?: number;
  minSizeSqft?: number;
  maxSizeSqft?: number;
  completion?: "ready" | "off_plan" | "any";
  handoverByYear?: number;
  dealType?: "sale" | "rent";
  postHandoverPlan?: boolean;
  furnished?: boolean;
  waterfront?: boolean;
  amenities?: string[];
  keywords?: string;
  sort?: "best_match" | "price_low_to_high" | "price_high_to_low" | "handover_soonest";
  limit?: number;
};

type Scored = { p: AgentProperty; units: UnitType[]; reasons: string[]; soft: number; price: number | null };

function bedsOk(c: SearchCriteria, b: number | null): boolean {
  if (c.bedrooms?.length) return b != null && c.bedrooms.includes(b);
  if (c.minBedrooms != null) return b != null && b >= c.minBedrooms;
  return true;
}

/**
 * Location, developer, type and completion: the checks that need only names
 * and a few metadata fields. The search runs them on the light index to pick
 * candidates, and evaluate() runs the same function on full rows, so the two
 * can never disagree. Returns the reasons to show, or null when it fails.
 */
function listingChecks(p: Listing, c: SearchCriteria): string[] | null {
  const reasons: string[] = [];
  if (c.locations?.length) {
    const hit = c.locations.find((l) => matchesLocation(p, l));
    if (!hit) return null;
    reasons.push(`in ${p.community?.name ?? hit}`);
  }
  if (c.developer) {
    if (!p.developer || !fuzzyPhrase(p.developer.name, c.developer)) return null;
    reasons.push(`by ${p.developer.name}`);
  }
  if (c.propertyTypes?.length) {
    const have = propertyTypes(p);
    const want = c.propertyTypes.map((t) => norm(t).replace(/s$/, ""));
    if (!want.some((w) => have.includes(w))) return null;
  }

  const done = completion(p);
  if (c.completion === "ready" && !done.ready) return null;
  if (c.completion === "off_plan" && done.ready) return null;
  if (c.handoverByYear != null) {
    const year = Number((done.handoverDate ?? "").slice(0, 4));
    if (!done.ready && !(year > 0 && year <= c.handoverByYear)) return null;
    reasons.push(done.ready ? "already completed" : `handover ${done.handover}`);
  }
  return reasons;
}

function evaluate(p: AgentProperty, c: SearchCriteria): Scored | null {
  const m = meta(p);
  const reasons: string[] = [];
  let soft = 0;

  // Deal is per-unit (metadata.listing: sale/rent/both); fall back to the
  // project-level dealType/forRent when a property has no units.
  {
    const want = c.dealType ?? "sale";
    const visible = p.units.filter((u) => !u.hidden);
    const deals = visible.map((u) => unitListing(u.metadata));
    const offersRent = visible.length
      ? deals.some((l) => l === "rent" || l === "both")
      : m.dealType === "rent" || (m as { forRent?: boolean }).forRent === true;
    const offersSale = visible.length
      ? deals.some((l) => l === "sale" || l === "both")
      : m.dealType !== "rent";
    if (want === "rent" ? !offersRent : !offersSale) return null;
  }

  const listing = listingChecks(p, c);
  if (!listing) return null;
  reasons.push(...listing);

  if (c.postHandoverPlan) {
    if (!m.postHandover && !paymentPlans(p).some((pl) => /post/i.test(pl.schedule))) return null;
    reasons.push("has a post-handover payment plan");
  }

  // Bedrooms, budget and size are checked per unit type when the project has
  // them, so the quoted price is the price of what the person asked for.
  const all = unitTypes(p);
  let units: UnitType[];
  if (all.length) {
    units = all.filter((u) => {
      if (!bedsOk(c, u.bedrooms)) return false;
      if (c.maxPriceAed != null && !(u.priceFromAed != null && u.priceFromAed <= c.maxPriceAed)) return false;
      if (c.minPriceAed != null && !((u.priceToAed ?? u.priceFromAed ?? 0) >= c.minPriceAed)) return false;
      if (c.maxSizeSqft != null && !(u.sizeFromSqft != null && u.sizeFromSqft <= c.maxSizeSqft)) return false;
      if (c.minSizeSqft != null && !((u.sizeToSqft ?? u.sizeFromSqft ?? 0) >= c.minSizeSqft)) return false;
      return true;
    });
    if (!units.length) return null;
  } else {
    units = [];
    const lo = m.minBedrooms ?? p.bedrooms;
    const hi = m.maxBedrooms ?? p.bedrooms;
    if (c.bedrooms?.length && !c.bedrooms.some((b) => lo != null && hi != null && b >= lo && b <= hi)) return null;
    if (c.minBedrooms != null && !(hi != null && hi >= c.minBedrooms)) return null;
    const price = pos(p.priceAed);
    if (c.maxPriceAed != null && !(price != null && price <= c.maxPriceAed)) return null;
    if (c.minPriceAed != null && !((pos(m.maxPriceAed) ?? price ?? 0) >= c.minPriceAed)) return null;
    if (c.maxSizeSqft != null && !(pos(p.areaSqft) != null && p.areaSqft! <= c.maxSizeSqft)) return null;
    if (c.minSizeSqft != null && !((pos(m.maxSizeSqft) ?? pos(p.areaSqft) ?? 0) >= c.minSizeSqft)) return null;
  }

  const price = units.length
    ? Math.min(...units.map((u) => u.priceFromAed ?? Infinity))
    : pos(p.priceAed);
  const priceOk = price != null && Number.isFinite(price) ? price : null;
  if (c.maxPriceAed != null && priceOk != null) reasons.push(`from ${aed(priceOk)}, within the ${aed(c.maxPriceAed)} budget`);
  if (c.bedrooms?.length || c.minBedrooms != null) {
    const beds = [...new Set(units.map((u) => bedLabel(u.bedrooms)))];
    if (beds.length) reasons.push(`has ${beds.join("/")} units`);
  }

  // Soft preferences rank results; they never hide one.
  if (c.furnished && (p.furnished || /furnished/.test(m.furnishing ?? ""))) {
    soft++;
    reasons.push(`furnishing: ${(m.furnishing ?? "furnished").replace(/_/g, " ")}`);
  }
  if (c.waterfront && p.waterfront) {
    soft++;
    reasons.push("tagged waterfront");
  }
  for (const a of c.amenities ?? []) {
    const hit = p.amenities.find((x) => fuzzyPhrase(x.amenity.name, a));
    if (hit) {
      soft++;
      reasons.push(`amenity: ${hit.amenity.name}`);
    }
  }
  if (c.keywords && fuzzyPhrase(`${p.title} ${p.description ?? ""}`, c.keywords)) soft++;

  return { p, units, reasons, soft, price: priceOk };
}

function rank(list: Scored[], c: SearchCriteria): Scored[] {
  const byPrice = (a: Scored, b: Scored) => (a.price ?? Infinity) - (b.price ?? Infinity);
  const handover = (s: Scored) => {
    const d = completion(s.p);
    return d.ready ? 0 : Date.parse(d.handoverDate ?? "") || Infinity;
  };
  switch (c.sort) {
    case "price_low_to_high":
      return list.sort(byPrice);
    case "price_high_to_low":
      return list.sort((a, b) => byPrice(b, a));
    case "handover_soonest":
      return list.sort((a, b) => handover(a) - handover(b));
    default:
      return list.sort((a, b) => b.soft - a.soft || byPrice(a, b));
  }
}

export function summarize(s: Scored | { p: AgentProperty; units?: UnitType[]; reasons?: string[] }) {
  const p = s.p;
  const m = meta(p);
  const done = completion(p);
  const all = unitTypes(p);
  const beds = all.map((u) => u.bedrooms).filter((b): b is number => b != null);
  const plans = paymentPlans(p);
  return {
    id: p.id,
    name: p.title,
    url: projectUrl(p),
    area: p.community?.name ?? null,
    emirate: p.community?.emirate ?? null,
    developer: p.developer?.name ?? null,
    types: propertyTypes(p),
    priceFromAed: aed(p.priceAed),
    priceToAed: aed(m.maxPriceAed),
    rental: rentalInfo(p),
    bedrooms: beds.length
      ? `${bedLabel(Math.min(...beds))}–${bedLabel(Math.max(...beds))}`
      : p.bedrooms != null
        ? bedLabel(p.bedrooms)
        : null,
    matchingUnits: groupByBedrooms(s.units ?? []).map(describeGroup),
    completion: done.status,
    handover: done.ready ? null : done.handover,
    constructionProgressPct: done.constructionProgressPct,
    saleStatus: p.availability ?? m.saleStatus ?? null,
    paymentPlan: plans[0] ? `${plans[0].name}: ${plans[0].schedule}` : null,
    otherPaymentPlans: Math.max(0, plans.length - 1),
    brochureOnFile: p.documents.some((d) => d.kind === "brochure"),
    whyItMatches: s.reasons ?? [],
  };
}

/**
 * Budget, bedrooms and size, checked by the database. These are exactly the
 * per-unit rules in evaluate() — one visible unit must meet all of them, and a
 * project with no visible units is checked on its own price and size — so the
 * database never drops a property evaluate() would keep. The min-price /
 * min-size rules and the no-unit bedroom range stay in evaluate() only.
 */
function unitWhere(c: SearchCriteria): Prisma.PropertyWhereInput | null {
  const beds = c.bedrooms?.length ? { in: c.bedrooms } : c.minBedrooms != null ? { gte: c.minBedrooms } : undefined;
  const price = c.maxPriceAed != null ? { gt: 0, lte: c.maxPriceAed } : undefined;
  const size = c.maxSizeSqft != null ? { gt: 0, lte: c.maxSizeSqft } : undefined;
  if (!beds && !price && !size) return null;
  return {
    OR: [
      { units: { some: { hidden: false, bedrooms: beds, priceAed: price, areaSqft: size } } },
      { units: { none: { hidden: false } }, priceAed: price, areaSqft: size },
    ],
  };
}

/**
 * Every live property that meets all the hard requirements, best first.
 * Names/areas/types are matched on the light index (typo-tolerant), budget /
 * bedrooms / size by the database, and only the rows that pass both are read
 * in full and given the final check — never a capped "first N" list.
 */
async function matching(index: IndexRow[], c: SearchCriteria): Promise<Scored[]> {
  const where: Prisma.PropertyWhereInput[] = [LIVE];
  const ids = index.filter((p) => listingChecks(p, c)).map((p) => p.id);
  if (!ids.length) return [];
  // Nothing narrowed by name/area/type: skip the id list (it would name every
  // property) — this also lets a listing newer than the index through.
  if (ids.length < index.length) where.push({ id: { in: ids } });
  const units = unitWhere(c);
  if (units) where.push(units);
  // One round trip for the ids that pass; full rows only for those.
  const found = await prisma.property.findMany({
    where: { AND: where },
    select: { id: true },
    // Same tie order as before: most recently updated first.
    orderBy: { updatedAt: "desc" },
  });
  const rows = await fullRows(found.map((r) => r.id));
  return rank(rows.map((p) => evaluate(p, c)).filter((x): x is Scored => x != null), c);
}

export async function searchProperties(c: SearchCriteria, indexRows?: Promise<IndexRow[]>) {
  const index = await (indexRows ?? loadIndex());
  const limit = Math.min(Math.max(c.limit ?? 4, 1), 8);
  const matches = await matching(index, c);
  const notes: string[] = [];
  if (c.waterfront && !index.some((p) => p.waterfront))
    notes.push("No listing in the data is tagged waterfront, so that could not be checked — do not claim any result is waterfront.");
  if (c.dealType === "rent" && !matches.length)
    notes.push("There are no rental listings in the current inventory — everything listed is for sale.");

  const result: Record<string, unknown> = {
    totalMatches: matches.length,
    showing: Math.min(limit, matches.length),
    results: matches.slice(0, limit).map(summarize),
  };

  if (!matches.length) {
    // ALIGN → EDUCATE → ALTERNATIVES: show what comes closest, labelled with
    // exactly which requirement had to be relaxed.
    const relaxations: [string, SearchCriteria][] = [
      ["budget", { ...c, minPriceAed: undefined, maxPriceAed: undefined, sort: "price_low_to_high" }],
      ["location", { ...c, locations: undefined }],
      ["bedrooms", { ...c, bedrooms: undefined, minBedrooms: undefined }],
      ["property type", { ...c, propertyTypes: undefined }],
      ["completion / handover", { ...c, completion: undefined, handoverByYear: undefined }],
    ];
    const alternatives: unknown[] = [];
    // All at once (one wait instead of five); the first two that find
    // something are used, in this order, as before.
    const found = await Promise.all(relaxations.map(([, cc]) => matching(index, cc)));
    for (const [i, [relaxed]] of relaxations.entries()) {
      const alt = found[i];
      if (alt.length) {
        alternatives.push({ relaxed, totalMatches: alt.length, examples: alt.slice(0, 3).map(summarize) });
      }
      if (alternatives.length >= 2) break;
    }
    result.alternatives = alternatives;
    notes.push(
      alternatives.length
        ? "Nothing matches every requirement. The alternatives each relax ONE requirement (named in 'relaxed') — present them as alternatives, not matches."
        : "Nothing in the inventory comes close; say so honestly and offer a specialist or a different brief.",
    );
  }
  if (notes.length) result.notes = notes;
  return { result, shownIds: matches.slice(0, limit).map((s) => s.p.id) };
}

// ---------------------------------------------------------------- lookups

/**
 * Resolve a property by id, slug or name: exact, then "name contains" either
 * way ("lunaya" → every Lunaya project), then one typo per long word ("mason"
 * → the Maison projects). Returns several when ambiguous.
 */
export function findProperty<T extends { id: string; slug: string; title: string }>(list: T[], ref: string): T[] {
  const r = ref.trim();
  const exact = list.find((p) => p.id === r || p.slug === r || norm(p.title) === norm(r));
  if (exact) return [exact];
  const contains = list.filter((p) => norm(p.title).includes(norm(r)) || norm(r).includes(norm(p.title)));
  if (contains.length) return contains;
  return list.filter((p) => fuzzyPhrase(p.title, r));
}

/**
 * Find a property among ALL live listings (the light index), then read just
 * that one row in full. Several matches → their names, to ask which one.
 */
export async function findAnyProperty(
  index: IndexRow[],
  ref: string,
): Promise<{ property: AgentProperty } | { candidates: string[] }> {
  const live = findProperty(index, ref);
  if (live.length > 1) return { candidates: live.map((p) => p.title) };
  if (live.length === 1) {
    const [p] = await fullRows([live[0].id]);
    if (p) return { property: p };
  }
  // Sold-out / withdrawn projects are still answerable ("is X available?" → no).
  const p = await prisma.property.findFirst({
    where: { deletedAt: null, OR: [{ id: ref }, { slug: ref }, { title: { equals: ref, mode: "insensitive" } }] },
    include: agentInclude,
  });
  return p ? { property: p } : { candidates: [] };
}

function cleanText(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!t || /^SEED DATA/i.test(t)) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** The description as the agent sees it: the About and Location sections. */
function describe(p: AgentProperty) {
  const sections = descriptionSections(p);
  const text = (key: string, max: number) =>
    cleanText(sections.find((s) => s.key === key)?.paragraphs.join(" "), max);
  return {
    description: text("about", 600) ?? cleanText(p.description, 600),
    locationNotes: text("location", 500),
  };
}

/** Nearby distances stored on metadata.nearbyData, as readable strings. */
function nearbyFacts(metadata: unknown) {
  const nd = (
    metadata as {
      nearbyData?: {
        landmarks?: { name?: unknown; km?: unknown }[];
        schools?: { name?: unknown; km?: unknown }[];
        hospitals?: { name?: unknown; km?: unknown }[];
        metro?: { name?: unknown; km?: unknown }[];
      };
    } | null
  )?.nearbyData;
  if (!nd) return null;
  const fmt = (arr: { name?: unknown; km?: unknown }[] | undefined) =>
    Array.isArray(arr)
      ? arr
          .filter(
            (x) => typeof x?.name === "string" && typeof x?.km === "number",
          )
          .map((x) => `${x.name as string}: ${x.km as number} km by road`)
      : [];
  const landmarks = fmt(nd.landmarks);
  const schools = fmt(nd.schools);
  const hospitals = fmt(nd.hospitals);
  const metro = fmt(nd.metro);
  if (!landmarks.length && !schools.length && !hospitals.length && !metro.length)
    return null;
  return { landmarks, schools, hospitals, metro };
}

/** Rental availability from per-unit listing + rent price (metadata). */
function rentalInfo(p: AgentProperty) {
  const m = meta(p);
  const visible = p.units.filter((u) => !u.hidden);
  const rentUnits = visible.filter((u) => {
    const l = unitListing(u.metadata);
    return l === "rent" || l === "both";
  });
  if (!rentUnits.length) {
    const byProject =
      m.dealType === "rent" || (m as { forRent?: boolean }).forRent === true;
    return { availableForRent: byProject };
  }
  const rents = rentUnits
    .map((u) => (u.metadata as { rentPriceAed?: number } | null)?.rentPriceAed)
    .filter((n): n is number => typeof n === "number" && n > 0);
  return {
    availableForRent: true,
    rentableUnits: rentUnits.length,
    rentFromAedPerYear: rents.length ? aed(Math.min(...rents)) : null,
    rentToAedPerYear: rents.length ? aed(Math.max(...rents)) : null,
  };
}

export function propertyDetails(p: AgentProperty) {
  const m = meta(p);
  const done = completion(p);
  return {
    ...summarize({ p }),
    rental: rentalInfo(p),
    nearby: nearbyFacts(p.metadata),
    listingStatus: p.status,
    summary: p.summary || null,
    keyPoints: highlightList(p.highlights),
    ...describe(p),
    district: m.district ?? null,
    unitsByBedrooms: groupByBedrooms(unitTypes(p)).map(describeGroup),
    paymentPlans: paymentPlans(p),
    handoverDate: done.handoverDate,
    serviceCharge: m.serviceCharge ?? null,
    furnishing: m.furnishing ? m.furnishing.replace(/_/g, " ") : p.furnished ? "furnished" : null,
    escrowAccountNumber: m.escrowNumber || null,
    reraStatus: p.reraStatus,
    rentalYieldPct: p.rentalYield,
    amenities: p.amenities.map((a) => a.amenity.name),
    documents: p.documents.map((d) => ({ title: d.title, kind: d.kind, url: d.url })),
    dataLastUpdated: p.updatedAt.toISOString().slice(0, 10),
    notOnFile: [
      p.rentalYield == null && "rental yield / ROI",
      !m.serviceCharge && "service charge",
      !p.reraStatus && "RERA status",
      p.bathrooms == null && p.units.every((u) => u.bathrooms == null) && "bathroom counts",
      "discounts or offers",
      "views / floor of specific units",
    ].filter(Boolean),
  };
}

export function availability(p: AgentProperty, opts: { bedrooms?: number; unit?: string }) {
  let units = unitTypes(p);
  if (opts.bedrooms != null) units = units.filter((u) => u.bedrooms === opts.bedrooms);
  if (opts.unit) units = units.filter((u) => norm(u.unit) === norm(opts.unit));
  const out = {
    property: p.title,
    url: projectUrl(p),
    listingStatus: p.status,
    rental: rentalInfo(p),
    saleStatus: p.availability ?? meta(p).saleStatus ?? null,
    units: opts.unit ? units.map(describeUnit) : groupByBedrooms(units).map(describeGroup),
    asOf: p.updatedAt.toISOString().slice(0, 10),
    note: "Availability as of the last data sync. Floors and views of individual units are not in the data. A specialist confirms live availability.",
  };
  if (!units.length) {
    return {
      ...out,
      note: `${opts.unit ? `Unit "${opts.unit}"` : opts.bedrooms != null ? `${bedLabel(opts.bedrooms)} units` : "Unit types"} not found in the data for this property. ${out.note}`,
    };
  }
  return out;
}

export async function developerInfo(name: string) {
  const devs = await prisma.developer.findMany({
    include: {
      properties: {
        where: { deletedAt: null },
        include: agentInclude,
      },
    },
  });
  const hits = devs.filter((d) => fuzzyPhrase(d.name, name) || norm(name).includes(norm(d.name)));
  if (!hits.length) return { found: false, message: `No developer matching "${name}" in the inventory.` };
  return {
    found: true,
    developers: hits.slice(0, 3).map((d) => ({
      name: d.name,
      description: cleanText(d.description, 500),
      website: d.website,
      projectsInInventory: d.properties
        .filter((p) => p.status === "ACTIVE" || p.status === "RESERVED")
        .map((p) => summarize({ p })),
      soldOutProjects: d.properties.filter((p) => p.status === "SOLD").map((p) => p.title),
      notOnFile: ["track record", "delivery history", "awards", "reputation"],
    })),
  };
}

export function areaOverview(inventory: IndexRow[]) {
  const areas = new Map<string, { emirate: string | null; projects: number; from: number }>();
  const devs = new Map<string, number>();
  for (const p of inventory) {
    const key = p.community?.name ?? meta(p).district ?? "Unspecified";
    const a = areas.get(key) ?? { emirate: p.community?.emirate ?? null, projects: 0, from: Infinity };
    a.projects++;
    a.from = Math.min(a.from, pos(p.priceAed) ?? Infinity);
    areas.set(key, a);
    if (p.developer) devs.set(p.developer.name, (devs.get(p.developer.name) ?? 0) + 1);
  }
  return {
    totalLiveListings: inventory.length,
    areas: [...areas]
      .sort((a, b) => b[1].projects - a[1].projects)
      .map(([name, a]) => ({ name, emirate: a.emirate, projects: a.projects, priceFromAed: aed(Number.isFinite(a.from) ? a.from : null) })),
    developers: [...devs].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, projects: n })),
  };
}
