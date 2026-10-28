import { getRequestSiteUrl } from "@/lib/site-url";
import { protectedResourceMetadata } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// RFC 9728 — OAuth 2.0 Protected Resource Metadata for the MCP endpoint.
export async function GET() {
  const base = await getRequestSiteUrl();
  return Response.json(protectedResourceMetadata(base), { headers: CORS });
}
