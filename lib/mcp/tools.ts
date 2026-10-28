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

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));
