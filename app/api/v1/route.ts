import { apiJson, apiOptions } from "@/lib/data-layer/http";
import { SITE_URL } from "@/lib/data-layer/canonical";

export function OPTIONS() {
  return apiOptions();
}

// Discovery document for AI agents: what this data layer is and how to query it.
export function GET() {
  const base = `${SITE_URL}/api/v1`;
  return apiJson({
    name: "DMProperties AI — Property Data Layer",
    version: "1.0.0",
    description:
      "A canonical, source-agnostic API over luxury real-estate inventory. " +
      "Exposes the full entity graph: developer → project → property → unit → " +
      "amenities → location (community) → nearby landmarks (schools, metros).",
    openapi: `${base}/openapi.json`,
    documentation: `${SITE_URL}/api-docs`,
    endpoints: {
      properties: `${base}/properties`,
      property: `${base}/properties/{slug}`,
      projects: `${base}/projects`,
      communities: `${base}/communities`,
      developers: `${base}/developers`,
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
