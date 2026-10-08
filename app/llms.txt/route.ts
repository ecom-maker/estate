import { SITE_URL } from "@/lib/data-layer/canonical";

export const dynamic = "force-dynamic";

// https://llmstxt.org — a map of this site's data for AI agents.
export function GET() {
  const body = `# DM Global

> A luxury real-estate portal for the UAE with an AI-native data layer. The
> inventory is exposed as a canonical, queryable API so AI agents can read and
> reason over it directly — not only through the website.

## For AI agents (agent-to-agent)

- [Agent Card](${SITE_URL}/.well-known/agent-card.json): A2A identity, skills, endpoints and supported locations
- A2A endpoint: POST ${SITE_URL}/api/a2a (JSON-RPC 2.0, method "message/send"). Send a text part ("2 bed in Dubai Marina under 3M") or a data part {"skill": "<id>", "params": {...}}. Skills: property-search, property-details, project-search, developer-profiles, market-insights, locations, latest-updates, sourcing-request, agent-directory.
- Not listed here? If nothing matches, send the buyer's name, phone or email and specific requirements with the "sourcing-request" skill; the DM Global team sources it from the market and contacts them.
- Identify yourself with an X-Agent-Id header (or message.metadata.agentId) so repeat queries are recognised.

## Data layer (canonical API)

- [API index](${SITE_URL}/api/v1): discovery document and endpoint map
- [OpenAPI spec](${SITE_URL}/api/v1/openapi.json): machine-readable API contract
- [API documentation](${SITE_URL}/api-docs): human-readable guide

## Endpoints

- GET ${SITE_URL}/api/v1/search — natural-language or structured search (q, type, community, developer, minBedrooms, minPrice, maxPrice, offPlan); returns interpreted intent + ranked matches
- GET ${SITE_URL}/api/v1/properties — list properties (filters: type, community, developer, minBedrooms, minPrice, maxPrice, offPlan, limit, offset)
- GET ${SITE_URL}/api/v1/properties/{slug} — full property with its entity graph
- GET ${SITE_URL}/api/v1/projects — off-plan projects
- GET ${SITE_URL}/api/v1/projects/{slug} — one project (off-plan development)
- GET ${SITE_URL}/api/v1/developers — developers
- GET ${SITE_URL}/api/v1/developers/{slug} — one developer with their listings
- GET ${SITE_URL}/api/v1/communities — communities with nearby landmarks
- GET ${SITE_URL}/api/v1/communities/{slug} — one community with its listings
- GET ${SITE_URL}/api/v1/locations — cities and communities directory
- GET ${SITE_URL}/api/v1/market?community={name}&bedrooms={n} — recorded sale/rent transactions and price trend for a community
- GET ${SITE_URL}/api/v1/updates?since={date} — listings added or changed since a date

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
