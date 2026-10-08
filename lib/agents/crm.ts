import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

/**
 * Agent CRM: remembers the AI agents that query the portal, so repeat callers
 * become known relationships (first contact, how often they ask, which areas
 * their users care about).
 *
 * Everything here is best-effort: a CRM write must never fail or slow down the
 * answer an agent is waiting for.
 */

export type AgentIdentity = {
  agentId: string;
  name: string | null;
  owner: string | null;
  userAgent: string | null;
};

/** After this many queries an agent counts as an established relationship. */
const ESTABLISHED_AFTER = 3;

const clean = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/**
 * Who is calling: the agent's own id from the X-Agent-Id header or A2A
 * message metadata; otherwise a stable anonymous id from its User-Agent.
 */
export function identifyAgent(
  request: Request,
  metadata?: Record<string, unknown> | null,
): AgentIdentity {
  const h = request.headers;
  const userAgent = clean(h.get("user-agent"), 400);
  const declared =
    clean(h.get("x-agent-id"), 120) ?? clean(metadata?.agentId, 120);
  const agentId =
    declared ??
    `anon:${createHash("sha256").update(userAgent ?? "unknown").digest("hex").slice(0, 16)}`;
  return {
    agentId,
    name: clean(h.get("x-agent-name")) ?? clean(metadata?.agentName),
    owner: clean(h.get("x-agent-owner")) ?? clean(metadata?.agentOwner),
    userAgent,
  };
}

function bump(json: unknown, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (json && typeof json === "object" && !Array.isArray(json)) {
    for (const [k, v] of Object.entries(json)) if (typeof v === "number") out[k] = v;
  }
  for (const k of keys) out[k] = (out[k] ?? 0) + 1;
  return out;
}

export async function recordAgentInteraction(
  who: AgentIdentity,
  event: {
    skill: string;
    /** Communities / areas the query was about. */
    areas?: string[];
    /** Listings returned to the agent. */
    propertiesRequested?: number;
    /** Listings opened in full detail. */
    propertiesViewed?: number;
  },
): Promise<void> {
  try {
    const existing = await prisma.agentContact.findUnique({
      where: { agentId: who.agentId },
      select: { queries: true, preferredAreas: true, skillsUsed: true },
    });
    const areas = [...new Set((event.areas ?? []).map((a) => a.trim()).filter(Boolean))];
    const queries = (existing?.queries ?? 0) + 1;
    const data = {
      name: who.name ?? undefined,
      owner: who.owner ?? undefined,
      userAgent: who.userAgent ?? undefined,
      lastInteractionAt: new Date(),
      queries,
      preferredAreas: bump(existing?.preferredAreas, areas),
      skillsUsed: bump(existing?.skillsUsed, [event.skill]),
      trustRelationship: queries >= ESTABLISHED_AFTER ? "established" : "new",
    };
    await prisma.agentContact.upsert({
      where: { agentId: who.agentId },
      create: {
        agentId: who.agentId,
        ...data,
        propertiesRequested: event.propertiesRequested ?? 0,
        propertiesViewed: event.propertiesViewed ?? 0,
      },
      update: {
        ...data,
        propertiesRequested: { increment: event.propertiesRequested ?? 0 },
        propertiesViewed: { increment: event.propertiesViewed ?? 0 },
      },
    });
  } catch (error) {
    console.warn("[agent-crm] could not record interaction", error);
  }
}
