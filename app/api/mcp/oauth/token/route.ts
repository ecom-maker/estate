import { getRequestSiteUrl } from "@/lib/site-url";
import {
  consumeAuthCode,
  issueTokens,
  oauthEnabled,
  pkceMatch,
  verifyRefreshToken,
} from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Cache-Control": "no-store",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function err(code: string, description: string, status = 400) {
  return Response.json(
    { error: code, error_description: description },
    { status, headers: CORS },
  );
}

export async function POST(request: Request) {
  if (!(await oauthEnabled())) {
    return err("invalid_request", "OAuth is disabled", 403);
  }

  const form = await request.formData();
  const grantType = String(form.get("grant_type") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const issuer = await getRequestSiteUrl();

  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const redirectUri = String(form.get("redirect_uri") ?? "");
    const codeVerifier = String(form.get("code_verifier") ?? "");

    const record = await consumeAuthCode(code);
    if (!record) return err("invalid_grant", "Invalid or expired code");
    if (record.client_id !== clientId)
      return err("invalid_grant", "client_id mismatch");
    if (record.redirect_uri !== redirectUri)
      return err("invalid_grant", "redirect_uri mismatch");
    if (!pkceMatch(codeVerifier, record.code_challenge))
      return err("invalid_grant", "PKCE verification failed");

    const tokens = await issueTokens({
      userId: record.user_id,
      clientId: record.client_id,
      scope: record.scope,
      resource: record.resource,
      issuer,
    });
    return Response.json(tokens, { headers: CORS });
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") ?? "");
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload?.sub) return err("invalid_grant", "Invalid refresh token");
    const tokens = await issueTokens({
      userId: String(payload.sub),
      clientId: clientId || String(payload.client_id ?? ""),
      scope: String(payload.scope ?? "mcp"),
      issuer,
    });
    return Response.json(tokens, { headers: CORS });
  }

  return err("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
}
