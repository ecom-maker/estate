import { apiJson, apiOptions } from "@/lib/data-layer/http";
import { SITE_URL } from "@/lib/data-layer/canonical";

export function OPTIONS() {
  return apiOptions();
}

// Discovery document for AI agents: what this data layer is and how to query it.
export function GET() {
  const base = `${SITE_URL}/api/v1`;
  return apiJson({
    name: "DM Global — Property Data Layer",
    version: "1.0.0",
    description:
      "A canonical, source-agnostic API over luxury real-estate inventory. " +
      "Exposes the full entity graph: developer → project → property → unit → " +
      "amenities → location (community) → nearby landmarks (schools, metros).",
    openapi: `${base}/openapi.json`,
    documentation: `${SITE_URL}/api-docs`,
    agentCard: `${SITE_URL}/.well-known/agent-card.json`,
    a2a: `${SITE_URL}/api/a2a`,
    endpoints: {
      search: `${base}/search`,
      properties: `${base}/properties`,
      property: `${base}/properties/{slug}`,
      projects: `${base}/projects`,
      project: `${base}/projects/{slug}`,
      developers: `${base}/developers`,
      developer: `${base}/developers/{slug}`,
      communities: `${base}/communities`,
      community: `${base}/communities/{slug}`,
      locations: `${base}/locations`,
      market: `${base}/market?community={name}&bedrooms={n}`,
      updates: `${base}/updates?since={date}`,
    },
    entities: [
      "developer",
      "project",
      "property",
      "unit",
      "amenity",
      "community",
      "landmark",
    ],
  });
}
