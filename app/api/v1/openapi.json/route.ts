import { apiJson, apiOptions } from "@/lib/data-layer/http";
import { SITE_URL } from "@/lib/data-layer/canonical";

export function OPTIONS() {
  return apiOptions();
}

export function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "DM Global — Property Data Layer",
      version: "1.0.0",
      description:
        "Canonical REST API over luxury real-estate inventory for websites and AI agents. " +
        "Entities: developer → project → property → unit → amenities → community → landmarks.",
    },
    servers: [{ url: `${SITE_URL}/api/v1` }],
    paths: {
      "/properties": {
        get: {
          operationId: "listProperties",
          summary: "List properties",
          parameters: [
            param("type", "villa|apartment|penthouse|townhouse|unit|land"),
            param("community", "Community name (partial match)"),
            param("developer", "Developer name (partial match)"),
            param("minBedrooms", "Minimum bedrooms", "integer"),
            param("minPrice", "Minimum price in AED", "number"),
            param("maxPrice", "Maximum price in AED", "number"),
            param("offPlan", "true = off-plan, false = ready", "boolean"),
            param("limit", "Page size (1–100, default 24)", "integer"),
            param("offset", "Result offset", "integer"),
          ],
          responses: okList("PropertySummary"),
        },
      },
      "/properties/{slug}": {
        get: {
          operationId: "getProperty",
          summary: "Get a property with its full entity graph",
          parameters: [pathParam("slug", "Property slug")],
          responses: {
            "200": jsonRef("Property"),
            "404": { description: "Not found" },
          },
        },
      },
      "/projects": {
        get: {
          operationId: "listProjects",
          summary: "List off-plan projects",
          parameters: [
            param("limit", "Page size", "integer"),
            param("offset", "Result offset", "integer"),
          ],
          responses: okList("PropertySummary"),
        },
      },
      "/communities": {
        get: {
          operationId: "listCommunities",
          summary: "List communities with nearby landmarks",
          responses: okList("Community"),
        },
      },
      "/developers": {
        get: {
          operationId: "listDevelopers",
          summary: "List developers",
          responses: okList("Developer"),
        },
      },
      "/search": {
        get: {
          operationId: "searchProperties",
          summary: "Natural-language or structured property search",
          parameters: [
            param("q", "Free-text request, e.g. '2 bed in Dubai Marina under 3M'"),
            param("type", "villa|apartment|penthouse|townhouse|unit|land"),
            param("community", "Community name"),
            param("developer", "Developer name"),
            param("minBedrooms", "Minimum bedrooms", "integer"),
            param("minPrice", "Minimum price in AED", "number"),
            param("maxPrice", "Maximum price in AED", "number"),
            param("offPlan", "true = off-plan, false = ready", "boolean"),
            param("limit", "Max results (1–100, default 24)", "integer"),
          ],
          responses: okList("PropertySummary"),
        },
      },
      "/market": {
        get: {
          operationId: "getMarketInsights",
          summary: "Recorded sale/rent transactions and price trend for a community",
          parameters: [
            { ...param("community", "Community name, e.g. Dubai Marina"), required: true },
            param("bedrooms", "Bedroom count (0 = studio)", "integer"),
          ],
          responses: {
            "200": { description: "OK" },
            "404": { description: "Too few recorded transactions" },
          },
        },
      },
      "/updates": {
        get: {
          operationId: "listUpdates",
          summary: "Listings added or changed since a date (default: last 7 days)",
          parameters: [
            param("since", "ISO date, e.g. 2026-10-01"),
            param("limit", "Max results (1–200, default 50)", "integer"),
          ],
          responses: okList("PropertySummary"),
        },
      },
    },
    components: {
      schemas: {
        PropertySummary: {
          type: "object",
          properties: {
            id: { type: "string" },
            slug: { type: "string" },
            url: { type: "string", format: "uri" },
            title: { type: "string" },
            propertyType: { type: "string" },
            dealType: { type: "string", enum: ["sale", "rent"] },
            price: { $ref: "#/components/schemas/Money" },
            bedrooms: { type: "integer", nullable: true },
            bathrooms: { type: "integer", nullable: true },
            areaSqft: { type: "number", nullable: true },
            offPlan: { type: "boolean" },
            community: { type: "string", nullable: true },
            developer: { type: "string", nullable: true },
            image: { type: "string", nullable: true },
          },
        },
        Property: {
          type: "object",
          description:
            "Full canonical property: status, price, size, features, developer, " +
            "location (community + nearby schools/metros), amenities, units, media, " +
            "payment plan, timeline and price history.",
          properties: {
            id: { type: "string" },
            slug: { type: "string" },
            title: { type: "string" },
            propertyType: { type: "string" },
            dealType: { type: "string", enum: ["sale", "rent"] },
            status: { type: "object" },
            price: { $ref: "#/components/schemas/Money" },
            size: { type: "object" },
            features: { type: "object" },
            developer: { type: "object", nullable: true },
            location: { type: "object" },
            amenities: { type: "array", items: { type: "string" } },
            units: { type: "array", items: { type: "object" } },
            media: { type: "object" },
            priceHistory: { type: "object" },
          },
        },
        Community: {
          type: "object",
          properties: {
            name: { type: "string" },
            slug: { type: "string" },
            city: { type: "string", nullable: true },
            emirate: { type: "string", nullable: true },
            propertyCount: { type: "integer" },
            nearbyLandmarks: { type: "object" },
          },
        },
        Developer: {
          type: "object",
          properties: {
            name: { type: "string" },
            slug: { type: "string" },
            website: { type: "string", nullable: true },
            propertyCount: { type: "integer" },
          },
        },
        Money: {
          type: "object",
          properties: {
            currency: { type: "string", example: "AED" },
            amount: { type: "number", nullable: true },
          },
        },
      },
    },
  };

  return apiJson(spec);
}

function param(name: string, description: string, type = "string") {
  return { name, in: "query", required: false, description, schema: { type } };
}
function pathParam(name: string, description: string) {
  return {
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "string" },
  };
}
function jsonRef(schema: string) {
  return {
    description: "OK",
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schema}` },
      },
    },
  };
}
function okList(itemSchema: string) {
  return {
    "200": {
      description: "OK",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              object: { type: "string" },
              total: { type: "integer" },
              data: {
                type: "array",
                items: { $ref: `#/components/schemas/${itemSchema}` },
              },
            },
          },
        },
      },
    },
  };
}
