import { oauthEnabled, registerClient } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// RFC 7591 — Dynamic Client Registration. Public clients (PKCE), no secret.
export async function POST(request: Request) {
  if (!(await oauthEnabled())) {
    return Response.json(
      { error: "invalid_request", error_description: "OAuth is disabled" },
      { status: 403, headers: CORS },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "Invalid JSON" },
      { status: 400, headers: CORS },
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      )
    : [];
  if (redirectUris.length === 0) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris is required",
      },
      { status: 400, headers: CORS },
    );
  }

  const client = await registerClient({
    redirect_uris: redirectUris,
    client_name:
      typeof body.client_name === "string" ? body.client_name : undefined,
  });

  return Response.json(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(Date.parse(client.created_at) / 1000),
      redirect_uris: client.redirect_uris,
      client_name: client.client_name,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: CORS },
  );
}
