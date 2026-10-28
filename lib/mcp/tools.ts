/**
 * MCP tool registry for DM Global.
 *
 * Each tool is a thin wrapper over the public `/api/v1` data layer, so the MCP
 * surface never drifts from the REST API. Handlers call the deployment's own
 * origin (passed in as `base`) and return the endpoint's JSON verbatim.
 */

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolContext = { base: string };

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

const PROPERTY_TYPES = [
  "villa",
  "apartment",
  "penthouse",
  "townhouse",
  "unit",
  "land",
];

/** Build a query string from args, skipping undefined/null/empty values. */
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** GET a v1 endpoint on this deployment and return the parsed JSON. */
async function getJson(ctx: ToolContext, path: string): Promise<unknown> {
  const res = await fetch(`${ctx.base}/api/v1${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text || `HTTP ${res.status}` };
  }
  if (!res.ok) {
    // v1 errors are shaped { error: { status, message } }; fall back gracefully.
    const err =
      typeof json === "object" && json && "error" in json
        ? (json as { error: unknown }).error
        : null;
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : typeof err === "string"
          ? err
          : `Request failed (HTTP ${res.status})`;
    throw new Error(message);
  }
  return json;
}

const str = (desc: string) => ({ type: "string", description: desc });
const num = (desc: string) => ({ type: "number", description: desc });
const bool = (desc: string) => ({ type: "boolean", description: desc });

const listingFilters = {
  type: { ...str("Property type"), enum: PROPERTY_TYPES },
  community: str("Community / area name, e.g. 'Downtown Dubai'"),
  developer: str("Developer name, e.g. 'Binghatti'"),
  minBedrooms: num("Minimum bedrooms"),
  minPrice: num("Minimum price in AED"),
  maxPrice: num("Maximum price in AED"),
  offPlan: bool("true = off-plan only, false = completed only"),
  limit: num("Max results (1–100, default 24)"),
};

export const TOOLS: ToolDef[] = [
  {
    name: "search_properties",
    description:
      "Search DM Global's luxury inventory. Accepts a natural-language query " +
      "(`q`) and/or structured filters. Returns the interpreted intent plus " +
      "ranked matches with price, beds, community and developer.",
    inputSchema: {
      type: "object",
      properties: {
        q: str("Natural-language query, e.g. '3-bed off-plan in Dubai Marina under 4M'"),
        ...listingFilters,
      },
      additionalProperties: false,
    },
    handler: (a, ctx) => getJson(ctx, `/search${qs(a)}`),
  },
  {
    name: "list_properties",
    description:
      "List completed/ready properties with structured filters (no ranking). " +
      "Use search_properties for natural-language or relevance-ranked results.",
    inputSchema: {
      type: "object",
      properties: { ...listingFilters },
      additionalProperties: false,
    },
    handler: (a, ctx) => getJson(ctx, `/properties${qs(a)}`),
  },
  {
    name: "get_property",
    description: "Fetch one property/unit by its slug, with full detail.",
    inputSchema: {
      type: "object",
      properties: { slug: str("The property slug from a listing result") },
      required: ["slug"],
      additionalProperties: false,
    },
    handler: (a, ctx) =>
      getJson(ctx, `/properties/${encodeURIComponent(String(a.slug))}`),
  },
  {
    name: "list_projects",
    description: "List off-plan projects (developments), newest first.",
    inputSchema: {
      type: "object",
      properties: {
        limit: num("Max results (1–100, default 24)"),
        offset: num("Pagination offset (default 0)"),
      },
      additionalProperties: false,
    },
    handler: (a, ctx) => getJson(ctx, `/projects${qs(a)}`),
  },
  {
    name: "get_project",
    description: "Fetch one off-plan project by its slug, with full detail.",
    inputSchema: {
      type: "object",
      properties: { slug: str("The project slug") },
      required: ["slug"],
      additionalProperties: false,
    },
    handler: (a, ctx) =>
      getJson(ctx, `/projects/${encodeURIComponent(String(a.slug))}`),
  },
  {
    name: "list_developers",
    description: "List all developers with their project counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (_a, ctx) => getJson(ctx, `/developers`),
  },
  {
    name: "get_developer",
    description: "Fetch one developer by slug, with their projects.",
    inputSchema: {
      type: "object",
      properties: { slug: str("The developer slug") },
      required: ["slug"],
      additionalProperties: false,
    },
    handler: (a, ctx) =>
      getJson(ctx, `/developers/${encodeURIComponent(String(a.slug))}`),
  },
  {
    name: "market_insights",
    description:
      "Market data for a community from recorded DLD transactions " +
      "(sold/rented comparables, price trend). Optionally filter by bedrooms.",
    inputSchema: {
      type: "object",
      properties: {
        community: str("Community name, e.g. 'Dubai Marina'"),
        bedrooms: num("Bedroom count to segment by (optional)"),
      },
      required: ["community"],
      additionalProperties: false,
    },
    handler: (a, ctx) => getJson(ctx, `/market${qs(a)}`),
  },
  {
    name: "whats_new",
    description:
      "Listings added or changed since a date (newest first) — for keeping a " +
      "personal agent's view in sync.",
    inputSchema: {
      type: "object",
      properties: {
        since: str("ISO date, e.g. '2026-10-01' (default: last 7 days)"),
        limit: num("Max results (1–200, default 50)"),
      },
      additionalProperties: false,
    },
    handler: (a, ctx) => getJson(ctx, `/updates${qs(a)}`),
  },
];

// --- OpenAI / ChatGPT compatibility tools ------------------------------------
// ChatGPT's standard connectors + Deep Research require a server to expose two
// read-only tools named exactly `search` and `fetch`, with a fixed result
// shape. These are thin aliases over the data layer so DM Global works in every
// MCP client (Claude, the OpenAI API, and ChatGPT without Developer Mode).

type Detail = Record<string, unknown> & {
  title?: string;
  description?: string;
  url?: string;
  "@id"?: string;
  price?: { currency?: string; amount?: number | null };
  specs?: { bedrooms?: number | null; bathrooms?: number | null; areaSqft?: number | null };
  community?: { name?: string } | null;
  developer?: { name?: string } | null;
  offPlan?: boolean;
  delivery?: { handoverDate?: string | null };
};

function detailUrl(ctx: ToolContext, slug: string, d: Detail): string {
  return d.url ?? d["@id"] ?? `${ctx.base}/properties/${slug}`;
}

function detailText(d: Detail): string {
  const parts: string[] = [];
  if (d.title) parts.push(d.title);
  const facts: string[] = [];
  if (d.community?.name) facts.push(d.community.name);
  if (d.developer?.name) facts.push(`by ${d.developer.name}`);
  if (d.price?.amount) facts.push(`AED ${d.price.amount.toLocaleString()}`);
  if (d.specs?.bedrooms != null) facts.push(`${d.specs.bedrooms} bed`);
  if (d.specs?.bathrooms != null) facts.push(`${d.specs.bathrooms} bath`);
  if (d.specs?.areaSqft) facts.push(`${Math.round(d.specs.areaSqft)} sqft`);
  if (typeof d.offPlan === "boolean") facts.push(d.offPlan ? "off-plan" : "ready");
  if (d.delivery?.handoverDate) facts.push(`handover ${d.delivery.handoverDate}`);
  if (facts.length) parts.push(facts.join(" · "));
  if (d.description) parts.push(d.description);
  return parts.join("\n\n");
}

const COMPAT_TOOLS: ToolDef[] = [
  {
    name: "search",
    description:
      "Search DM Global's property inventory and return matching listings as " +
      "{id, title, url} results (OpenAI/ChatGPT deep-research compatible). " +
      "`id` is the listing slug — pass it to `fetch` for full detail.",
    inputSchema: {
      type: "object",
      properties: { query: str("What to search for (natural language)") },
      required: ["query"],
      additionalProperties: false,
    },
    handler: async (a, ctx) => {
      const res = (await getJson(
        ctx,
        `/search${qs({ q: a.query, limit: 15 })}`,
      )) as { data?: Array<Record<string, unknown>> };
      const results = (res.data ?? []).map((r) => {
        const title = [r.title, r.community, r.developer]
          .filter(Boolean)
          .join(" — ");
        return {
          id: String(r.slug ?? ""),
          title: title || String(r.title ?? r.slug ?? "Listing"),
          url: String(r.url ?? `${ctx.base}/properties/${r.slug}`),
        };
      });
      return { results };
    },
  },
  {
    name: "fetch",
    description:
      "Fetch one DM Global listing by its id (slug) and return its full " +
      "content as {id, title, text, url, metadata} (OpenAI/ChatGPT compatible).",
    inputSchema: {
      type: "object",
      properties: { id: str("The listing slug returned by `search`") },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (a, ctx) => {
      const slug = encodeURIComponent(String(a.id));
      let d: Detail;
      try {
        d = (await getJson(ctx, `/properties/${slug}`)) as Detail;
      } catch {
        // Fall back to a project (off-plan development) with the same slug.
        d = (await getJson(ctx, `/projects/${slug}`)) as Detail;
      }
      return {
        id: String(a.id),
        title: d.title ?? String(a.id),
        text: detailText(d),
        url: detailUrl(ctx, String(a.id), d),
        metadata: {
          price: d.price ?? null,
          community: d.community?.name ?? null,
          developer: d.developer?.name ?? null,
          offPlan: d.offPlan ?? null,
        },
      };
    },
  },
];

TOOLS.push(...COMPAT_TOOLS);

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));
