import { apiJson, apiError, apiOptions } from "@/lib/data-layer/http";
import { getMarketInsights } from "@/lib/property/market-data";
import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

/**
 * Market data for a community from recorded DLD transactions:
 * GET /api/v1/market?community=Dubai%20Marina&bedrooms=2
 * 404 when there are too few transactions to say anything (no estimates).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const community = searchParams.get("community")?.trim();
  if (!community) return apiError(400, "Pass ?community=<community name>");
  const bedsRaw = searchParams.get("bedrooms");
  const bedrooms = bedsRaw !== null && bedsRaw !== "" && Number.isInteger(Number(bedsRaw))
    ? Number(bedsRaw)
    : null;

  try {
    const insights = await getMarketInsights({ bedrooms, community: { name: community } });
    if (!insights) {
      return apiError(404, `Not enough recorded transactions for '${community}'`);
    }
    return apiJson({
      community,
      bedrooms,
      source: "Dubai Land Department transaction records",
      summary: {
        recentSales: insights.sold.length,
        medianSalePricePerSqftAed: median(insights.sold.map((t) => t.aed / t.area)),
        medianSalePriceAed: median(insights.sold.map((t) => t.aed)),
        medianAnnualRentAed: median(insights.rented.map((t) => t.aed)),
      },
      recentSales: insights.sold,
      recentRentals: insights.rented,
      trend: insights.trend,
      searchListings: `${SITE_URL}/api/v1/search?community=${encodeURIComponent(community)}`,
    });
  } catch (error) {
    return apiError(500, error instanceof Error ? error.message : "Failed to load market data");
  }
}
