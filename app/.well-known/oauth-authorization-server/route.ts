import { getRequestSiteUrl } from "@/lib/site-url";
import { authServerMetadata } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// RFC 8414 — OAuth 2.0 Authorization Server Metadata.
export async function GET() {
  const base = await getRequestSiteUrl();
  return Response.json(authServerMetadata(base), { headers: CORS });
}
