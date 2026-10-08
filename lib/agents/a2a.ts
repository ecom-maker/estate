import { AGENT_SKILLS } from "@/lib/agents/card";

/**
 * A2A (agent-to-agent) message handling, kept free of HTTP and database code
 * so the routing can be tested on its own.
 *
 * A personal agent sends a JSON-RPC `message/send` whose message has parts:
 *   { kind: "data", data: { skill: "market-insights", params: {...} } }  explicit
 *   { kind: "text", text: "2 bed in Dubai Marina under 3M" }             routed by keywords
 */

export type A2APart =
  | { kind: "text"; text: string }
  | { kind: "data"; data: Record<string, unknown> }
  | { kind: string; [key: string]: unknown };

export type A2AMessage = {
  role?: string;
  parts?: A2APart[];
  messageId?: string;
  contextId?: string;
  metadata?: Record<string, unknown>;
};

export type SkillCall = {
  skill: string;
  params: Record<string, string>;
  /** The free text, when the request came as text. */
  text: string | null;
};

const SKILL_IDS = new Set(AGENT_SKILLS.map((s) => s.id));

/** Keyword routes for plain-text requests; first match wins, else search. */
const TEXT_ROUTES: { skill: string; pattern: RegExp }[] = [
  { skill: "sourcing-request", pattern: /\b(source|sourcing|off[- ]market)\b/i },
  { skill: "agent-directory", pattern: /\b(skills?|capabilit|agent directory|what can you|specialist agents?)\b/i },
  { skill: "latest-updates", pattern: /\b(updates?|what'?s new|new listings|recently (added|listed)|latest listings)\b/i },
  { skill: "market-insights", pattern: /\b(market|price trends?|per sq ?ft|psf|transactions?|sold prices?|rental yield|rents?)\b/i },
  { skill: "locations", pattern: /\b(locations|communities|areas you cover|which areas)\b/i },
  { skill: "developer-profiles", pattern: /\bdevelopers?\b(?!.*\b(bed|villa|apartment|under|aed)\b)/i },
  { skill: "project-search", pattern: /\b(launch(es)?|new projects?|off[- ]?plan projects?|developments?)\b/i },
];

function stringParams(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (v === null || v === undefined) continue;
      if (["string", "number", "boolean"].includes(typeof v)) out[k] = String(v);
    }
  }
  return out;
}

export function textRoute(text: string): string {
  return TEXT_ROUTES.find((r) => r.pattern.test(text))?.skill ?? "property-search";
}

/** Work out which skill a message asks for. Null when it carries nothing usable. */
export function resolveSkillCall(message: A2AMessage | undefined): SkillCall | null {
  const parts = Array.isArray(message?.parts) ? message!.parts : [];
  const text =
    parts
      .filter((p): p is { kind: "text"; text: string } => p.kind === "text" && typeof p.text === "string")
      .map((p) => p.text.trim())
      .filter(Boolean)
      .join("\n") || null;

  const data = parts.find(
    (p): p is { kind: "data"; data: Record<string, unknown> } =>
      p.kind === "data" && !!p.data && typeof p.data === "object",
  )?.data;

  if (data && typeof data.skill === "string" && SKILL_IDS.has(data.skill)) {
    return { skill: data.skill, params: stringParams(data.params), text };
  }
  if (text) return { skill: textRoute(text), params: {}, text };
  if (data) return { skill: "property-search", params: stringParams(data.params ?? data), text: null };
  return null;
}

// JSON-RPC 2.0 / A2A error codes.
export const RPC_ERRORS = {
  parse: { code: -32700, message: "Parse error" },
  invalidRequest: { code: -32600, message: "Invalid Request" },
  methodNotFound: { code: -32601, message: "Method not found" },
  invalidParams: { code: -32602, message: "Invalid params" },
  internal: { code: -32603, message: "Internal error" },
  taskNotFound: { code: -32001, message: "Task not found" },
} as const;
