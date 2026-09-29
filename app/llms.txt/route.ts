import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

// https://llmstxt.org — a map of this site's data for AI agents.
export function GET() {
  const body = `# DMProperties AI

> A luxury real-estate portal for the UAE with an AI-native data layer. The
> inventory is exposed as a canonical, queryable API so AI agents can read and
> reason over it directly — not only through the website.

## Data layer (canonical API)

- [API index](${SITE_URL}/api/v1): discovery document and endpoint map
- [OpenAPI spec](${SITE_URL}/api/v1/openapi.json): machine-readable API contract
- [API documentation](${SITE_URL}/api-docs): human-readable guide

## Endpoints

- GET ${SITE_URL}/api/v1/properties — list properties (filters: type, community, developer, minBedrooms, minPrice, maxPrice, offPlan, limit, offset)
- GET ${SITE_URL}/api/v1/properties/{slug} — full property with its entity graph
- GET ${SITE_URL}/api/v1/projects — off-plan projects
- GET ${SITE_URL}/api/v1/communities — communities with nearby landmarks
- GET ${SITE_URL}/api/v1/developers — developers

## Entity graph

developer → project → property → unit → amenities → community (location) → nearby landmarks (schools, metro stations)

Each property detail page also embeds schema.org JSON-LD, and the site publishes a sitemap at ${SITE_URL}/sitemap.xml.
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
