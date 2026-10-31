import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import { getRequestSiteUrl } from "@/lib/site-url";
import { verifyPartnerKey } from "@/lib/partners/keys";
import {
  listingSchema,
  upsertListing,
  type IngestResult,
} from "@/lib/partners/ingest";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const MAX_BATCH = 100;

export function OPTIONS() {
  return apiOptions();
}

function keyFrom(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() ?? "";
}

/**
 * Inbound listing ingestion for partner companies.
 * POST: create/update listings (single object, array, or { listings: [...] }).
 * Auth: Authorization: Bearer <partner key>  (or X-API-Key).
 */
export async function POST(request: Request) {
  const partner = await verifyPartnerKey(keyFrom(request));
  if (!partner) return apiError(401, "Invalid or missing partner API key.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Request body must be valid JSON.");
  }

  const raw = Array.isArray(body)
    ? body
    : body && typeof body === "object" && "listings" in body
      ? (body as { listings: unknown[] }).listings
      : [body];

  if (!Array.isArray(raw) || raw.length === 0) {
    return apiError(400, "Provide a listing object, an array, or { listings: [...] }.");
  }
  if (raw.length > MAX_BATCH) {
    return apiError(400, `Too many listings in one request (max ${MAX_BATCH}).`);
  }

  const siteUrl = await getRequestSiteUrl();
  const results: IngestResult[] = [];

  for (const item of raw) {
    const parsed = listingSchema.safeParse(item);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      results.push({
        externalId:
          (item as { externalId?: string })?.externalId ?? "(unknown)",
        error: `${first.path.join(".") || "payload"}: ${first.message}`,
      });
      continue;
    }
    try {
      results.push(await upsertListing(partner, parsed.data, siteUrl));
    } catch (error) {
      results.push({
        externalId: parsed.data.externalId,
        error: error instanceof Error ? error.message : "Ingestion failed.",
      });
    }
  }

  const created = results.filter((r) => "action" in r && r.action === "created").length;
  const updated = results.filter((r) => "action" in r && r.action === "updated").length;
  const failed = results.filter((r) => "error" in r).length;

  return apiJson(
    {
      partner: partner.company,
      summary: { received: raw.length, created, updated, failed },
      note: "Submissions are saved as DRAFT and go live after DM Global review.",
      results,
    },
    { status: failed && !created && !updated ? 422 : 200 },
  );
}

/** List the authenticated partner's own submitted listings and their status. */
export async function GET(request: Request) {
  const partner = await verifyPartnerKey(keyFrom(request));
  if (!partner) return apiError(401, "Invalid or missing partner API key.");

  const siteUrl = await getRequestSiteUrl();
  const items = await prisma.property.findMany({
    where: { source: `partner:${partner.partnerId}`, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      externalId: true,
      slug: true,
      title: true,
      status: true,
      priceAed: true,
      updatedAt: true,
    },
  });

  return apiJson({
    partner: partner.company,
    total: items.length,
    data: items.map((p) => ({
      externalId: p.externalId,
      title: p.title,
      status: p.status,
      price: { currency: "AED", amount: p.priceAed },
      url: `${siteUrl}/properties/${p.slug}`,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}
