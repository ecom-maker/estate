import { SITE_URL } from "@/lib/data-layer/canonical";

/**
 * DM Global's agent identity for the agent-to-agent (A2A) ecosystem.
 *
 * Personal AI agents discover us through the Agent Card served at
 * /.well-known/agent-card.json (A2A protocol), query us over the JSON-RPC
 * endpoint at /api/a2a or the REST data layer at /api/v1, and get back the
 * same structured, source-backed data the website shows.
 */

export const AGENT_ID = "dmglobal-property-intelligence";
export const A2A_PROTOCOL_VERSION = "0.3.0";

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
  /** REST equivalent, for agents that prefer plain HTTP. */
  rest: string;
};

/** The specialist agents behind the gateway, exposed as A2A skills. */
export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: "property-search",
    name: "Property Agent — search & availability",
    description:
      "Find properties for sale in the UAE from a natural-language request or structured filters (type, community, developer, bedrooms, price range in AED, off-plan or ready). Returns ranked matches with price, size, location and a link.",
    tags: ["real-estate", "property-search", "dubai", "uae", "availability"],
    examples: [
      "2 bedroom apartments in Dubai Marina under 3M AED",
      '{"skill":"property-search","params":{"community":"Palm Jumeirah","minBedrooms":4}}',
    ],
    rest: "/api/v1/search",
  },
  {
    id: "property-details",
    name: "Property details",
    description:
      "Full record for one property or project by slug: units, floor plans, amenities, developer, community and nearby landmarks.",
    tags: ["real-estate", "property", "details"],
    examples: ['{"skill":"property-details","params":{"slug":"<slug from a search result>"}}'],
    rest: "/api/v1/properties/{slug}",
  },
  {
    id: "project-search",
    name: "Project Agent — developments & launches",
    description:
      "List off-plan developments and new launches, newest first, with starting prices and developers.",
    tags: ["real-estate", "off-plan", "new-launches", "projects"],
    examples: ["Latest off-plan launches", '{"skill":"project-search","params":{"limit":10}}'],
    rest: "/api/v1/projects",
  },
  {
    id: "developer-profiles",
    name: "Developer Agent — profiles & projects",
    description: "Developers active on the portal, and one developer's profile with their listings.",
    tags: ["real-estate", "developers"],
    examples: ['{"skill":"developer-profiles","params":{"slug":"emaar"}}'],
    rest: "/api/v1/developers",
  },
  {
    id: "market-insights",
    name: "Market Data Agent — trends & insights",
    description:
      "Recorded sale and rental transactions for a community: recent deals, median sale price per sq ft and a monthly price trend, optionally for one bedroom count. Returns nothing rather than an estimate when there are too few transactions.",
    tags: ["real-estate", "market-data", "prices", "rental-yield", "trends"],
    examples: [
      "Market prices in Jumeirah Village Circle for 1 bedrooms",
      '{"skill":"market-insights","params":{"community":"Dubai Marina","bedrooms":2}}',
    ],
    rest: "/api/v1/market",
  },
  {
    id: "locations",
    name: "Locations directory",
    description: "Cities and communities covered, with nearby landmarks (schools, metro stations).",
    tags: ["real-estate", "locations", "communities"],
    examples: ['{"skill":"locations"}'],
    rest: "/api/v1/locations",
  },
  {
    id: "latest-updates",
    name: "Updates feed",
    description:
      "Listings added or changed recently, so a personal agent can keep its user up to date without re-crawling.",
    tags: ["real-estate", "updates", "feed"],
    examples: ['{"skill":"latest-updates","params":{"since":"2026-10-01"}}'],
    rest: "/api/v1/updates",
  },
  {
    id: "agent-directory",
    name: "Agent Directory — specialist agents",
    description:
      "The specialist agents and endpoints available here, so a personal agent can route the right question to the right skill.",
    tags: ["directory", "referral"],
    examples: ['{"skill":"agent-directory"}'],
    rest: "/.well-known/agent-card.json",
  },
];

// Dubai is the core market; other emirates appear where listings exist (e.g. Ajman).
export const SUPPORTED_LOCATIONS = ["Dubai, UAE", "United Arab Emirates"];

/** A2A Agent Card (https://a2a-protocol.org — AgentCard). */
export function agentCard() {
  return {
    protocolVersion: A2A_PROTOCOL_VERSION,
    name: "DM Global Property Intelligence",
    description:
      "Real-estate agent for the UAE. Provides real-time property, project, developer and market data for Dubai and the wider UAE, taken from the DM Global portal's live inventory and recorded transactions. Answers are structured data with links back to the source listing; it does not make up listings or prices.",
    url: `${SITE_URL}/api/a2a`,
    preferredTransport: "JSONRPC",
    additionalInterfaces: [
      { url: `${SITE_URL}/api/a2a`, transport: "JSONRPC" },
      { url: `${SITE_URL}/api/v1`, transport: "HTTP+JSON" },
    ],
    provider: { organization: "DM Global", url: SITE_URL },
    version: "1.0.0",
    iconUrl: `${SITE_URL}/icon.svg`,
    documentationUrl: `${SITE_URL}/api-docs`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    // Read-only public data: no credentials needed. Agents are asked to
    // identify themselves (X-Agent-Id / message metadata.agentId) so repeat
    // callers are recognised.
    securitySchemes: {},
    security: [],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: AGENT_SKILLS.map(({ id, name, description, tags, examples }) => ({
      id,
      name,
      description,
      tags,
      examples,
      inputModes: ["text/plain", "application/json"],
      outputModes: ["application/json"],
    })),
    // Not part of the A2A schema; extra context for agents that read it.
    metadata: {
      agentId: AGENT_ID,
      supportedLocations: SUPPORTED_LOCATIONS,
      dataFreshness: "real-time (read from the live listings database on every request)",
      identification: {
        header: "X-Agent-Id",
        optionalHeaders: ["X-Agent-Name", "X-Agent-Owner"],
        a2aMetadata: "message.metadata.agentId",
      },
      endpoints: {
        a2a: `${SITE_URL}/api/a2a`,
        rest: `${SITE_URL}/api/v1`,
        openapi: `${SITE_URL}/api/v1/openapi.json`,
        llmsTxt: `${SITE_URL}/llms.txt`,
      },
    },
  };
}
