import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { kvGet, kvSet } from "@/lib/settings/kv";

/**
 * Minimal OAuth 2.1 Authorization Server for the MCP endpoint, so Claude's web
 * "custom connector" (which requires OAuth + Dynamic Client Registration) can
 * connect. PKCE (S256) is mandatory; clients are public (no secret).
 *
 * State lives in the generic settings table (no migration): registered clients
 * and short-lived auth codes. Access/refresh tokens are signed JWTs (HS256 with
 * AUTH_SECRET), so they need no storage.
 */

const CLIENTS_KEY = "mcp_oauth_clients";
const CODES_KEY = "mcp_oauth_codes";
const ENABLED_KEY = "mcp_oauth_enabled";

const ACCESS_TTL = "1h";
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL = "30d";
const CODE_TTL_MS = 5 * 60 * 1000;

function secret(): Uint8Array | null {
  // Same resolution as NextAuth (lib/auth): AUTH_SECRET, then NEXTAUTH_SECRET,
  // with ENCRYPTION_KEY as a last resort. Mismatching this silently disables
  // OAuth (oauthEnabled() returns false when no secret is found).
  const s =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.ENCRYPTION_KEY;
  return s ? new TextEncoder().encode(s) : null;
}

/** Whether a token-signing secret is configured (required for OAuth to work). */
export function oauthSecretAvailable(): boolean {
  return secret() !== null;
}

/** The stored on/off flag, independent of whether a secret is present. */
export async function oauthFlagOn(): Promise<boolean> {
  return (await kvGet<boolean>(ENABLED_KEY, false)) === true;
}

/** True only when the flag is on AND a signing secret exists. */
export async function oauthEnabled(): Promise<boolean> {
  if (secret() === null) return false;
  return oauthFlagOn();
}

export async function setOauthEnabled(on: boolean): Promise<void> {
  await kvSet(ENABLED_KEY, on);
}

// --- Dynamic Client Registration ---------------------------------------------

export type OauthClient = {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  created_at: string;
};

export async function registerClient(input: {
  redirect_uris: string[];
  client_name?: string;
}): Promise<OauthClient> {
  const clients = await kvGet<OauthClient[]>(CLIENTS_KEY, []);
  const client: OauthClient = {
    client_id: "mcp_client_" + randomBytes(16).toString("hex"),
    client_name: input.client_name,
    redirect_uris: input.redirect_uris,
    created_at: new Date().toISOString(),
  };
  await kvSet(CLIENTS_KEY, [...clients, client].slice(-200));
  return client;
}

export async function getClient(clientId: string): Promise<OauthClient | null> {
  const clients = await kvGet<OauthClient[]>(CLIENTS_KEY, []);
  return clients.find((c) => c.client_id === clientId) ?? null;
}

// --- Authorization codes -----------------------------------------------------

type AuthCode = {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  user_id: string;
  scope: string;
  resource?: string;
  exp: number;
};

export async function createAuthCode(
  d: Omit<AuthCode, "code" | "exp">,
): Promise<string> {
  const now = Date.now();
  const codes = (await kvGet<AuthCode[]>(CODES_KEY, [])).filter(
    (c) => c.exp > now,
  );
  const code = randomBytes(24).toString("base64url");
  codes.push({ ...d, code, exp: now + CODE_TTL_MS });
  await kvSet(CODES_KEY, codes.slice(-500));
  return code;
}

/** One-time consume: returns the code record (if valid) and removes it. */
export async function consumeAuthCode(code: string): Promise<AuthCode | null> {
  const now = Date.now();
  const codes = await kvGet<AuthCode[]>(CODES_KEY, []);
  const found = codes.find((c) => c.code === code && c.exp > now) ?? null;
  await kvSet(
    CODES_KEY,
    codes.filter((c) => c.code !== code && c.exp > now),
  );
  return found;
}

export function pkceMatch(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const hash = createHash("sha256").update(verifier).digest("base64url");
  return hash === challenge;
}

// --- Tokens ------------------------------------------------------------------

export async function issueTokens(opts: {
  userId: string;
  clientId: string;
  scope: string;
  resource?: string;
  issuer: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}> {
  const key = secret();
  if (!key) throw new Error("No signing secret configured");
  const claims = { scope: opts.scope, client_id: opts.clientId };

  const access = await new SignJWT({ ...claims, token_use: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.userId)
    .setIssuedAt()
    .setIssuer(opts.issuer)
    .setAudience(opts.resource ?? opts.issuer)
    .setExpirationTime(ACCESS_TTL)
    .sign(key);

  const refresh = await new SignJWT({ ...claims, token_use: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.userId)
    .setIssuedAt()
    .setIssuer(opts.issuer)
    .setExpirationTime(REFRESH_TTL)
    .sign(key);

  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    scope: opts.scope,
  };
}

export async function verifyAccessToken(
  token: string,
): Promise<JWTPayload | null> {
  const key = secret();
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.token_use === "access" ? payload : null;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<JWTPayload | null> {
  const key = secret();
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.token_use === "refresh" ? payload : null;
  } catch {
    return null;
  }
}

// --- Discovery metadata ------------------------------------------------------

export function protectedResourceMetadata(base: string) {
  return {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
  };
}

export function authServerMetadata(base: string) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/mcp/oauth/authorize`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    registration_endpoint: `${base}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  };
}
