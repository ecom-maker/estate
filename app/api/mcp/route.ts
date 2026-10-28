import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { TOOLS, TOOL_MAP, type ToolContext } from "@/lib/mcp/tools";
import { mcpAuthEnabled, verifyMcpKey } from "@/lib/mcp/keys";
import { oauthEnabled, verifyAccessToken } from "@/lib/mcp/oauth";
import { getRequestSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// MCP protocol version this server speaks. If a client requests a different
// one on initialize, we echo theirs back when it looks valid.
const PROTOCOL_VERSION = "2025-06-18";
const SERVER = { name: "DM Global Property MCP", version: "1.0.0" };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, authorization, mcp-protocol-version, mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

type RpcId = string | number | null;
type RpcMessage = {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: RpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: RpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * API-key gate. Auth is enforced as soon as any active key exists (created in
 * the admin UI) or MCP_API_KEYS is set; otherwise the server is open (read-only
 * public data). Keys are presented via `Authorization: Bearer <key>` or `?key=`.
 * Returns the caller's client id for logging, or ok=false when rejected.
 */
async function authClient(
  request: Request,
): Promise<{ ok: boolean; clientId: string }> {
  const [keysEnabled, oauthOn] = await Promise.all([
    mcpAuthEnabled(),
    oauthEnabled(),
  ]);
  if (!keysEnabled && !oauthOn) return { ok: true, clientId: "anonymous" };

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null;

  // Prefer an OAuth access token (JWT), then fall back to an API key.
  if (bearer && oauthOn) {
    const payload = await verifyAccessToken(bearer);
    if (payload) {
      return {
        ok: true,
        clientId: `oauth:${payload.client_id ?? payload.sub ?? "user"}`,
      };
    }
  }
  const url = new URL(request.url);
  const key = bearer ?? url.searchParams.get("key") ?? "";
  return verifyMcpKey(key);
}

/** 401 challenge headers that point MCP clients at the OAuth metadata. */
async function challengeHeaders(): Promise<Record<string, string>> {
  const base = await getRequestSiteUrl();
  return {
    ...CORS,
    "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
  };
}

/** Best-effort usage log — never blocks or fails a tool call. */
async function logCall(entry: {
  tool: string;
  args: unknown;
  clientId: string;
  ok: boolean;
  ms: number;
  error?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: "mcp_call",
        entityType: "mcp",
        entityId: entry.tool,
        meta: {
          tool: entry.tool,
          args: entry.args,
          client: entry.clientId,
          ok: entry.ok,
          ms: entry.ms,
          ...(entry.error ? { error: entry.error } : {}),
        } as Prisma.InputJsonValue,
      },
    });
  } catch {
    // ignore logging failures
  }
}

async function handleMessage(
  msg: RpcMessage,
  ctx: ToolContext & { clientId: string },
): Promise<object | null> {
  const { id = null, method } = msg;

  switch (method) {
    case "initialize": {
      const requested = (msg.params?.protocolVersion as string) || "";
      const protocolVersion = /^\d{4}-\d{2}-\d{2}$/.test(requested)
        ? requested
        : PROTOCOL_VERSION;
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions:
          "DM Global luxury real-estate data. Use search_properties for " +
          "natural-language queries, get_project / get_property for detail, " +
          "and market_insights for DLD transaction trends.",
      });
    }

    // Notifications (no response).
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      const tool = TOOL_MAP.get(name);
      if (!tool) {
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      }
      const started = Date.now();
      try {
        const data = await tool.handler(args, ctx);
        void logCall({
          tool: name,
          args,
          clientId: ctx.clientId,
          ok: true,
          ms: Date.now() - started,
        });
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool failed";
        void logCall({
          tool: name,
          args,
          clientId: ctx.clientId,
          ok: false,
          ms: Date.now() - started,
          error: message,
        });
        // Tool-level errors are reported in the result, per MCP convention.
        return rpcResult(id, {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method ?? "(none)"}`);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Human/agent discovery when the endpoint is opened directly. */
export async function GET() {
  return Response.json(
    {
      name: SERVER.name,
      version: SERVER.version,
      protocol: "Model Context Protocol (Streamable HTTP, JSON-RPC 2.0)",
      protocolVersion: PROTOCOL_VERSION,
      transport: "Send JSON-RPC requests via HTTP POST to this URL.",
      tools: TOOLS.map((t) => t.name),
      authentication:
        (await mcpAuthEnabled()) || (await oauthEnabled())
          ? "Authentication required (OAuth bearer token or API key)."
          : "Open (read-only public data).",
    },
    { headers: CORS },
  );
}

export async function POST(request: Request) {
  const auth = await authClient(request);
  if (!auth.ok) {
    return Response.json(rpcError(null, -32001, "Unauthorized"), {
      status: 401,
      headers: await challengeHeaders(),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), {
      status: 400,
      headers: CORS,
    });
  }

  const ctx = { base: new URL(request.url).origin, clientId: auth.clientId };

  // A batch (array) or a single message.
  if (Array.isArray(body)) {
    const responses = (
      await Promise.all(
        body.map((m) => handleMessage(m as RpcMessage, ctx)),
      )
    ).filter((r): r is object => r !== null);
    // All-notifications batch → 202 with no body.
    if (responses.length === 0) {
      return new Response(null, { status: 202, headers: CORS });
    }
    return Response.json(responses, { headers: CORS });
  }

  const response = await handleMessage(body as RpcMessage, ctx);
  if (response === null) {
    return new Response(null, { status: 202, headers: CORS });
  }
  return Response.json(response, { headers: CORS });
}
