import { apiJson, apiOptions } from "@/lib/data-layer/http";
import { agentCard } from "@/lib/agents/card";

// A2A Agent Card: how other AI agents discover this portal's agent.
export function GET() {
  return apiJson(agentCard(), {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

export function OPTIONS() {
  return apiOptions();
}
