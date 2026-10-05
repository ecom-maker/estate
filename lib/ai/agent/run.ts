import { resolveLLMConfig } from "@/lib/ai/provider";
import { getPrompts } from "@/lib/ai/get-prompt";
import { agentContext, type AgentChannel } from "./prompt";
import { runTool, TOOL_DEFINITIONS, type ToolContext } from "./tools";
import type { SearchCriteria } from "./inventory";

/**
 * The sales agent: an LLM tool-calling loop over the inventory and lead tools.
 *
 * Tool rounds are non-streaming (the model must finish deciding before we can
 * run its tools); the caller streams the final text. Returns null when no LLM
 * is configured or the provider fails, so callers fall back to the
 * deterministic search reply instead of showing an error.
 */

export type AgentTurn = { role: "user" | "assistant"; content: string };

export type AgentResult = {
  reply: string;
  /** Ids from the last search this turn — null when no search ran. */
  propertyIds: string[] | null;
  lastSearch: SearchCriteria | null;
  leadIds: string[];
  tools: { name: string; ok: boolean; ms: number }[];
  model: string;
  inputTokens: number;
  outputTokens: number;
};

type ApiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  [extra: string]: unknown;
};

const MAX_ROUNDS = 6;
const CALL_TIMEOUT_MS = 25_000;
/** Netlify streams for up to 60s; leave room for the fallback reply. */
const TOTAL_BUDGET_MS = 48_000;

export async function runSalesAgent(opts: {
  history: AgentTurn[];
  message: string;
  channel: AgentChannel;
  sessionId: string;
  phone?: string | null;
  currentProperty?: { id: string; title: string } | null;
  userId?: string | null;
}): Promise<AgentResult | null> {
  const cfg = await resolveLLMConfig({ userId: opts.userId });
  if (!cfg) return null;
  const started = Date.now();

  const { salesAgent } = await getPrompts(["salesAgent"]);
  const messages: ApiMessage[] = [
    { role: "system", content: `${salesAgent}\n\n${agentContext(opts)}` },
    ...opts.history
      .filter((t) => t.content.trim())
      .slice(-20)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 3000) })),
    { role: "user", content: opts.message.slice(0, 4000) },
  ];

  const ctx: ToolContext = { channel: opts.channel, sessionId: opts.sessionId, phone: opts.phone };
  const result: AgentResult = {
    reply: "",
    propertyIds: null,
    lastSearch: null,
    leadIds: [],
    tools: [],
    model: cfg.model,
    inputTokens: 0,
    outputTokens: 0,
  };

  // Busy providers answer 503 "high demand" in bursts. Try the configured
  // model, retry once, then move to a fallback model for the rest of the turn.
  const models = [cfg.model, ...fallbackModels(cfg.baseUrl).filter((m) => m !== cfg.model)];
  let active = 0;

  for (let round = 0; round <= MAX_ROUNDS; round++) {
    // Last round: no more tools, the model must answer with what it has.
    const finalRound = round === MAX_ROUNDS;
    let message: ApiMessage | null = null;
    for (let attempt = 0; !message; attempt++) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
      if (remaining < 3_000) return null;
      const out = await complete({ ...cfg, model: models[active] }, messages, finalRound, Math.min(CALL_TIMEOUT_MS, remaining), result);
      if ("message" in out) {
        message = out.message;
        result.model = models[active];
      } else if (!out.retryable) {
        return null;
      } else if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
      } else if (active < models.length - 1) {
        active++;
      } else {
        return null;
      }
    }

    const calls = message.tool_calls ?? [];
    if (!calls.length || finalRound) {
      result.reply = (message.content ?? "").trim();
      break;
    }

    // Keep the assistant message exactly as returned: Gemini attaches thought
    // signatures (extra_content) that must be sent back with the tool results.
    messages.push(message);
    const outputs = await Promise.all(
      calls.map(async (call) => {
        const t0 = Date.now();
        let output: unknown;
        let ok = true;
        try {
          output = await runTool(call.function.name, JSON.parse(call.function.arguments || "{}"), ctx);
          ok = !(output && typeof output === "object" && "error" in output);
        } catch (error) {
          ok = false;
          output = { error: error instanceof Error ? error.message.slice(0, 300) : "Tool failed" };
        }
        result.tools.push({ name: call.function.name, ok, ms: Date.now() - t0 });
        return { role: "tool" as const, tool_call_id: call.id, content: JSON.stringify(output) };
      }),
    );
    messages.push(...outputs);
  }

  if (!result.reply) return null;
  result.propertyIds = ctx.shownPropertyIds ?? null;
  result.lastSearch = ctx.lastSearch ?? null;
  result.leadIds = ctx.leadIds ?? [];
  return result;
}

/** Models to fall back to, comma-separated in LLM_FALLBACK_MODELS. */
function fallbackModels(baseUrl: string): string[] {
  const env = process.env.LLM_FALLBACK_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  if (env?.length) return env;
  return baseUrl.includes("generativelanguage.googleapis.com") ? ["gemini-flash-latest"] : [];
}

type Completion = { message: ApiMessage } | { retryable: boolean };

async function complete(
  cfg: { baseUrl: string; apiKey: string; model: string },
  messages: ApiMessage[],
  noTools: boolean,
  timeoutMs: number,
  usage: AgentResult,
): Promise<Completion> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.4,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: noTools ? "none" : "auto",
        ...(process.env.AI_AGENT_REASONING_EFFORT
          ? { reasoning_effort: process.env.AI_AGENT_REASONING_EFFORT }
          : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("sales agent LLM error", cfg.model, res.status, (await res.text()).slice(0, 300));
      return { retryable: res.status === 429 || res.status >= 500 };
    }
    const data = (await res.json()) as {
      choices?: { message?: ApiMessage }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    usage.inputTokens += data.usage?.prompt_tokens ?? 0;
    usage.outputTokens += data.usage?.completion_tokens ?? 0;
    const message = data.choices?.[0]?.message;
    return message ? { message } : { retryable: true };
  } catch (error) {
    // Timeout or network error: worth another try.
    console.error("sales agent LLM call failed", cfg.model, error instanceof Error ? error.message : error);
    return { retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
