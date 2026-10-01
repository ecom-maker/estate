import type { PropertyType } from "@prisma/client";
import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import { extractSearchIntent } from "@/lib/ai/intent";
import { searchProperties } from "@/lib/search/search-service";
import type { SearchIntent } from "@/lib/validation/search-intent";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";
const TYPES = ["villa", "apartment", "penthouse", "townhouse", "unit", "land"];

export function OPTIONS() {
  return apiOptions();
}

/**
 * Agent-facing search. Accepts a natural-language `q` (parsed to intent) and/or
 * structured params (type, community, developer, minBedrooms, minPrice,
 * maxPrice, offPlan). Returns the interpreted intent + ranked matches.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  try {
    const intent: SearchIntent = q ? await extractSearchIntent(q) : {};

    // Structured params override / add to the parsed intent.
    const type = searchParams.get("type")?.toLowerCase();
    if (type && TYPES.includes(type))
      intent.propertyType = type as SearchIntent["propertyType"];
    const community = searchParams.get("community");
    if (community) intent.community = community;
    const developer = searchParams.get("developer");
    if (developer) intent.developer = developer;
    const minBeds = Number(searchParams.get("minBedrooms"));
    if (Number.isFinite(minBeds) && minBeds > 0) intent.bedrooms = minBeds;
    const minPrice = Number(searchParams.get("minPrice"));
    if (Number.isFinite(minPrice) && minPrice > 0) intent.minPriceAED = minPrice;
    const maxPrice = Number(searchParams.get("maxPrice"));
    if (Number.isFinite(maxPrice) && maxPrice > 0) intent.maxPriceAED = maxPrice;
    const offPlan = searchParams.get("offPlan");
    if (offPlan === "true") intent.offPlan = true;
    if (offPlan === "false") intent.offPlan = false;

    const results = await searchProperties(intent);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 24, 1),
      100,
    );

    return apiJson({
      query: q || null,
      intent,
      total: results.length,
      data: results.slice(0, limit).map((p) => ({
        "@id": `${SITE_URL}/properties/${p.slug}`,
        id: p.id,
        slug: p.slug,
        url: `${SITE_URL}/properties/${p.slug}`,
        title: p.title,
        propertyType: (p.type as PropertyType).toLowerCase(),
        price: { currency: "AED", amount: p.priceAed },
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        areaSqft: p.areaSqft,
        offPlan: p.offPlan,
        community: p.community?.name ?? null,
        developer: p.developer?.name ?? null,
        image: p.images?.[0]?.url ?? null,
        matchScore: p.score,
      })),
    });
  } catch (error) {
    return apiError(
      500,
      error instanceof Error ? error.message : "Search failed",
    );
  }
}
