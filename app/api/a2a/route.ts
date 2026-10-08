import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { agentCard, AGENT_ID, AGENT_SKILLS } from "@/lib/agents/card";
import { RPC_ERRORS, resolveSkillCall, type A2AMessage, type SkillCall } from "@/lib/agents/a2a";
import { identifyAgent, recordAgentInteraction } from "@/lib/agents/crm";
import { extractSearchIntent } from "@/lib/ai/intent";
import { rateLimit } from "@/lib/security/rate-limit";
import { SITE_URL } from "@/lib/data-layer/canonical";
import { GET as searchGET } from "@/app/api/v1/search/route";
import { GET as propertyGET } from "@/app/api/v1/properties/[slug]/route";
import { GET as projectsGET } from "@/app/api/v1/projects/route";
import { GET as developersGET } from "@/app/api/v1/developers/route";
import { GET as developerGET } from "@/app/api/v1/developers/[slug]/route";
import { GET as marketGET } from "@/app/api/v1/market/route";
import { GET as locationsGET } from "@/app/api/v1/locations/route";
import { GET as updatesGET } from "@/app/api/v1/updates/route";

export const dynamic = "force-dynamic";

/**
 * A2A endpoint (JSON-RPC 2.0) for personal and partner AI agents.
 * Discovered via /.well-known/agent-card.json. Each skill is answered by the
 * same handler that serves the REST data layer, so both return the same data.
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Agent-Id, X-Agent-Name, X-Agent-Owner",
  "Cache-Control": "no-store",
};

type RpcId = string | number | null;

const rpcResult = (id: RpcId, result: unknown) =>
  NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: HEADERS });

const rpcError = (id: RpcId, error: { code: number; message: string }, data?: unknown, status = 200) =>
  NextResponse.json(
    { jsonrpc: "2.0", id, error: data === undefined ? error : { ...error, data } },
    { status, headers: HEADERS },
  );

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}

// A GET is a person or crawler looking: show them the card.
export function GET() {
  return NextResponse.json(agentCard(), { headers: HEADERS });
}

/** Call one of the REST data-layer handlers in-process and read its JSON. */
async function callRest(
  handler: (req: Request, ctx: { params: Promise<{ slug: string }> }) => Promise<Response> | Response,
  path: string,
  query: Record<string, string> = {},
  slug?: string,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const url = new URL(`${SITE_URL}${path}`);
  for (const [k, v] of Object.entries(query)) if (v !== "") url.searchParams.set(k, v);
  const res = await handler(new Request(url), { params: Promise.resolve({ slug: slug ?? "" }) });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

type SkillOutcome = {
  summary: string;
  data: unknown;
  areas: string[];
  requested: number;
  viewed: number;
};

const listLength = (body: Record<string, unknown>) =>
  Array.isArray(body.data) ? body.data.length : 0;

async function runSkill(call: SkillCall): Promise<SkillOutcome> {
  const p = call.params;
  const none = { areas: [], requested: 0, viewed: 0 };

  switch (call.skill) {
    case "property-search": {
      const query = { ...p, ...(call.text && !p.q ? { q: call.text } : {}) };
      const r = await callRest(searchGET, "/api/v1/search", query);
      const intent = (r.body.intent ?? {}) as { community?: string };
      const n = listLength(r.body);
      return {
        summary: r.ok
          ? `${r.body.total ?? n} matching properties; returning ${n}, best match first.`
          : `Search failed: ${errorText(r.body)}`,
        data: r.body,
        areas: [p.community, intent.community].filter((a): a is string => !!a),
        requested: n,
        viewed: 0,
      };
    }
    case "property-details": {
      if (!p.slug) return { summary: "Pass params.slug (from a search result).", data: null, ...none };
      const r = await callRest(propertyGET, `/api/v1/properties/${p.slug}`, {}, p.slug);
      const location = (r.body.location ?? {}) as { community?: { name?: string } };
      return {
        summary: r.ok ? `Details for ${String(r.body.title ?? p.slug)}.` : errorText(r.body),
        data: r.body,
        areas: location.community?.name ? [location.community.name] : [],
        requested: 0,
        viewed: r.ok ? 1 : 0,
      };
    }
    case "project-search": {
      const r = await callRest(projectsGET, "/api/v1/projects", { limit: p.limit ?? "24", offset: p.offset ?? "0" });
      const n = listLength(r.body);
      return { summary: `${r.body.total ?? n} off-plan projects; returning ${n}, newest first.`, data: r.body, areas: [], requested: n, viewed: 0 };
    }
    case "developer-profiles": {
      const r = p.slug
        ? await callRest(developerGET, `/api/v1/developers/${p.slug}`, {}, p.slug)
        : await callRest(developersGET, "/api/v1/developers");
      return {
        summary: r.ok ? (p.slug ? `Developer profile: ${p.slug}.` : `${listLength(r.body)} developers.`) : errorText(r.body),
        data: r.body,
        ...none,
      };
    }
    case "market-insights": {
      let community: string | undefined = p.community;
      if (!community && call.text) community = (await extractSearchIntent(call.text)).community;
      if (!community) {
        return { summary: "Which community? Pass params.community, e.g. \"Dubai Marina\".", data: null, ...none };
      }
      const r = await callRest(marketGET, "/api/v1/market", { community, bedrooms: p.bedrooms ?? "" });
      return {
        summary: r.ok ? `Recorded transactions and price trend for ${community}.` : errorText(r.body),
        data: r.ok ? r.body : null,
        areas: [community],
        requested: 0,
        viewed: 0,
      };
    }
    case "locations": {
      const r = await callRest(locationsGET, "/api/v1/locations");
      return { summary: "Cities and communities covered.", data: r.body, ...none };
    }
    case "latest-updates": {
      const r = await callRest(updatesGET, "/api/v1/updates", { since: p.since ?? "", limit: p.limit ?? "" });
      const n = listLength(r.body);
      return {
        summary: r.ok ? `${r.body.total ?? n} listings added or changed since ${String(r.body.since ?? "")}.` : errorText(r.body),
        data: r.body,
        areas: [],
        requested: n,
        viewed: 0,
      };
    }
    default: {
      // agent-directory
      return {
        summary: `${AGENT_SKILLS.length} specialist skills. Send a data part {"skill": "<id>", "params": {...}} or plain text.`,
        data: {
          agentCard: `${SITE_URL}/.well-known/agent-card.json`,
          skills: AGENT_SKILLS.map(({ id, name, description, examples, rest }) => ({
            id,
            name,
            description,
            examples,
            rest: `${SITE_URL}${rest}`,
          })),
        },
        ...none,
      };
    }
  }
}

function errorText(body: Record<string, unknown>): string {
  const e = body.error as { message?: string } | undefined;
  return e?.message ?? "Request failed";
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`a2a:${ip}`, 60, 60_000).ok) {
    return rpcError(null, { code: -32000, message: "Rate limited, try again shortly" }, undefined, 429);
  }

  let body: { jsonrpc?: string; id?: RpcId; method?: string; params?: { message?: A2AMessage } };
  try {
    body = await request.json();
  } catch {
    return rpcError(null, RPC_ERRORS.parse);
  }
  const id = body?.id ?? null;
  if (body?.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(id, RPC_ERRORS.invalidRequest);
  }

  switch (body.method) {
    case "message/send":
      break;
    case "agent/getAuthenticatedExtendedCard":
      return rpcResult(id, agentCard());
    case "tasks/get":
    case "tasks/cancel":
      // Every answer is returned directly as a message; no tasks are kept.
      return rpcError(id, RPC_ERRORS.taskNotFound);
    default:
      return rpcError(id, RPC_ERRORS.methodNotFound, { supported: ["message/send", "agent/getAuthenticatedExtendedCard"] });
  }

  const message = body.params?.message;
  const call = resolveSkillCall(message);
  if (!call) {
    return rpcError(id, RPC_ERRORS.invalidParams, "params.message needs a text part or a data part {skill, params}");
  }

  try {
    const outcome = await runSkill(call);
    const who = identifyAgent(request, message?.metadata ?? null);
    await recordAgentInteraction(who, {
      skill: call.skill,
      areas: outcome.areas,
      propertiesRequested: outcome.requested,
      propertiesViewed: outcome.viewed,
    });
    return rpcResult(id, {
      kind: "message",
      role: "agent",
      messageId: randomUUID(),
      contextId: message?.contextId ?? randomUUID(),
      parts: [
        { kind: "text", text: outcome.summary },
        { kind: "data", data: { skill: call.skill, result: outcome.data } },
      ],
      metadata: { agentId: AGENT_ID, source: SITE_URL },
    });
  } catch (error) {
    return rpcError(id, RPC_ERRORS.internal, error instanceof Error ? error.message : undefined);
  }
}
