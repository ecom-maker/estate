import { auth } from "@/lib/auth";
import { getRequestSiteUrl } from "@/lib/site-url";
import {
  createAuthCode,
  getClient,
  oauthEnabled,
} from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

function htmlError(message: string, status = 400) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Authorization error</title>` +
      `<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">` +
      `<h1 style="font-size:1.25rem">Authorization error</h1>` +
      `<p style="color:#b91c1c">${message}</p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

type Validated = {
  ok: true;
  client: Awaited<ReturnType<typeof getClient>> & object;
  redirectUri: string;
  clientId: string;
  codeChallenge: string;
  scope: string;
  state: string;
  resource?: string;
};

/** Validate the request's client + redirect_uri and PKCE params. */
async function validate(
  params: URLSearchParams,
): Promise<Validated | { ok: false; error: string }> {
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const responseType = params.get("response_type") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const method = params.get("code_challenge_method") ?? "";

  if (responseType !== "code")
    return { ok: false, error: "Only response_type=code is supported." };
  if (!codeChallenge || method !== "S256")
    return { ok: false, error: "PKCE with code_challenge_method=S256 is required." };

  const client = await getClient(clientId);
  if (!client) return { ok: false, error: "Unknown client_id." };
  if (!client.redirect_uris.includes(redirectUri))
    return { ok: false, error: "redirect_uri does not match the registered client." };

  return {
    ok: true,
    client,
    redirectUri,
    clientId,
    codeChallenge,
    scope: params.get("scope") ?? "mcp",
    state: params.get("state") ?? "",
    resource: params.get("resource") ?? undefined,
  };
}

export async function GET(request: Request) {
  if (!(await oauthEnabled())) return htmlError("OAuth is not enabled.", 403);

  const url = new URL(request.url);
  const v = await validate(url.searchParams);
  if (!v.ok) return htmlError(v.error);

  const session = await auth();
  if (!session?.user) {
    // Send the user to sign in, then back to this exact authorize URL.
    const base = await getRequestSiteUrl();
    const next = encodeURIComponent(url.pathname + url.search);
    return Response.redirect(`${base}/login?next=${next}`, 302);
  }

  const who =
    (session.user as { email?: string; name?: string }).email ??
    (session.user as { name?: string }).name ??
    "your account";
  const appName = v.client.client_name || "An MCP client";
  const hidden = (name: string, value: string) =>
    `<input type="hidden" name="${name}" value="${value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")}">`;

  const html =
    `<!doctype html><meta charset="utf-8"><title>Authorize access</title>` +
    `<body style="font-family:system-ui;max-width:30rem;margin:4rem auto;padding:0 1rem;color:#0f172a">` +
    `<p style="letter-spacing:.2em;text-transform:uppercase;font-size:.7rem;color:#b08d57">DM Global</p>` +
    `<h1 style="font-size:1.4rem;margin:.5rem 0">Authorize access</h1>` +
    `<p style="color:#475569"><strong>${appName}</strong> is requesting access to DM Global's ` +
    `property data (read-only) on behalf of <strong>${who}</strong>.</p>` +
    `<form method="post" style="margin-top:1.5rem;display:flex;gap:.75rem">` +
    hidden("client_id", v.clientId) +
    hidden("redirect_uri", v.redirectUri) +
    hidden("code_challenge", v.codeChallenge) +
    hidden("scope", v.scope) +
    hidden("state", v.state) +
    hidden("resource", v.resource ?? "") +
    `<button name="decision" value="approve" style="background:#0f172a;color:#fff;border:0;border-radius:.375rem;padding:.6rem 1.1rem;font-size:.9rem;cursor:pointer">Approve</button>` +
    `<button name="decision" value="deny" style="background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:.375rem;padding:.6rem 1.1rem;font-size:.9rem;cursor:pointer">Deny</button>` +
    `</form></body>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  if (!(await oauthEnabled())) return htmlError("OAuth is not enabled.", 403);

  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [k, val] of form.entries()) params.set(k, String(val));

  const v = await validate(params);
  if (!v.ok) return htmlError(v.error);

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return htmlError("You must be signed in to approve access.", 401);

  const sep = v.redirectUri.includes("?") ? "&" : "?";
  const state = v.state ? `&state=${encodeURIComponent(v.state)}` : "";

  if (params.get("decision") !== "approve") {
    return Response.redirect(`${v.redirectUri}${sep}error=access_denied${state}`, 302);
  }

  const code = await createAuthCode({
    client_id: v.clientId,
    redirect_uri: v.redirectUri,
    code_challenge: v.codeChallenge,
    user_id: userId,
    scope: v.scope,
    resource: v.resource,
  });

  return Response.redirect(
    `${v.redirectUri}${sep}code=${encodeURIComponent(code)}${state}`,
    302,
  );
}
