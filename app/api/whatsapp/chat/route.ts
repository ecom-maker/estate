import { timingSafeEqual } from "node:crypto";
import { extractSearchIntent, isRealEstateQuery } from "@/lib/ai/intent";
import { logAiUsage } from "@/lib/ai/usage";
import { chatModel } from "@/lib/ai/respond";
import { runSalesAgent, type AgentTurn } from "@/lib/ai/agent/run";
import { toSearchIntent } from "@/lib/ai/agent/chat-stream";
import { prisma } from "@/lib/db/prisma";
import { searchProperties } from "@/lib/search/search-service";
import { rateLimit } from "@/lib/security/rate-limit";
import { failure } from "@/lib/api/response";
import { formatAED } from "@/lib/utils";
import {
  SearchIntentSchema,
  type SearchIntent,
} from "@/lib/validation/search-intent";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * WhatsApp message handler. n8n is only the messenger: it receives the WhatsApp
 * webhook, posts the sender + text here, and sends back whatever `reply` we
 * return. All the thinking and all the storage happen in this app, so n8n never
 * needs database credentials and web/WhatsApp can never drift apart.
 *
 * Replies come from the same AI sales agent as the website chat (discovery,
 * grounded recommendations, viewing/callback requests saved to `leads`). If
 * the AI is unavailable, the deterministic property search answers instead.
 *
 * Contract with the n8n workflow (scripts/n8n/dmproperties-whatsapp-assistant.json):
 *
 *   POST { phone, message, execution_id?, wa_message_id? }
 *     -> 200 { success: true,  reply, session_id, log_id }
 *     -> 200 { success: false, reply, error, log_id }   <- note: still 200
 *
 * A failure returns 200 on purpose. n8n must always have a `reply` to send, so
 * the customer is never left in silence; `success: false` plus `error` is how
 * the workflow (and whoever reads the execution) learns something broke.
 * Non-200 is reserved for the request never reaching the assistant at all:
 * a bad secret, a malformed body, or rate limiting.
 */

// The agent's tool rounds can take several seconds; give the function room.
export const maxDuration = 60;

const bodySchema = z.object({
  /** E.164, with or without a leading "+" - normalised to digits below. */
  phone: z.string().min(6).max(20),
  message: z.string().min(1).max(2000),
  execution_id: z.string().max(100).optional(),
  wa_message_id: z.string().max(200).optional(),
  previousIntent: SearchIntentSchema.partial().optional(),
});

/** What the customer sees when something on our side breaks. */
const FRIENDLY_ERROR =
  "Sorry, I had trouble looking that up just now. Please send your message again in a moment.";

const OFF_TOPIC =
  "I am the DM Global real-estate assistant, so I can only help with properties, " +
  "communities, projects and prices. Try asking about off-plan projects, " +
  "apartments, or a community like Dubai Marina.";

/**
 * Short follow-ups that only mean anything against the previous search. They
 * carry no intent of their own, so the topic check below would otherwise
 * decline them.
 */
const CONTINUATION =
  /^(yes|yeah|yep|ok|okay|sure|more|show more|next|any ?more|others?|continue|go on)\b/i;

/** How much of this sender's WhatsApp history the agent reads each turn. */
const HISTORY_MESSAGES = 20;

/** Digits only, so "+971 50 123 4567" and "971501234567" are the same person. */
function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Constant-time compare so the shared secret cannot be guessed byte by byte. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * WhatsApp has no markdown: **bold** renders literally (it uses *bold*), and
 * [label](url) shows as-is, so links become "label: url".
 */
function forWhatsApp(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1: $2")
    .replace(/\*\*(.+?)\*\*/g, "*$1*");
}

export async function POST(request: Request) {
  const started = Date.now();

  // --- 1. Authenticate n8n -------------------------------------------------
  // Without this the endpoint is open to anyone who finds the URL.
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!expected) {
    return failure(
      "NOT_CONFIGURED",
      "WHATSAPP_WEBHOOK_SECRET is not set on this deployment",
      503,
    );
  }
  if (!secretMatches(request.headers.get("x-webhook-secret"), expected)) {
    return failure("UNAUTHORIZED", "Invalid or missing x-webhook-secret", 401);
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return failure(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Invalid request body",
      400,
    );
  }

  const phone = normalisePhone(body.phone);
  const executionId = body.execution_id ?? null;
  const waMessageId = body.wa_message_id ?? null;

  // Per-sender cap: one person flooding us cannot exhaust the AI budget.
  if (!rateLimit(`wa:${phone}`, 20, 60_000).ok) {
    return failure("RATE_LIMITED", "Too many messages from this number", 429);
  }

  // --- 2. Duplicate guard --------------------------------------------------
  // WhatsApp retries webhooks it believes were not acknowledged. Without this
  // the customer gets the same answer twice. We replay the stored reply rather
  // than recomputing it, so the retry is answered consistently and for free.
  if (waMessageId) {
    const seen = await prisma.whatsappLog.findUnique({
      where: { waMessageId },
    });
    if (seen) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        reply: seen.reply ?? FRIENDLY_ERROR,
        session_id: seen.sessionId,
        log_id: seen.id,
      });
    }
  }

  /** Writes the permanent record. Never allowed to break the reply. */
  const log = async (fields: {
    status: string;
    reply?: string | null;
    error?: string | null;
    sessionId?: string | null;
    intent?: unknown;
    propertyIds?: string[];
  }): Promise<string | null> => {
    try {
      const row = await prisma.whatsappLog.create({
        data: {
          executionId,
          waMessageId,
          phone,
          sessionId: fields.sessionId ?? null,
          message: body.message,
          reply: fields.reply ?? null,
          status: fields.status,
          error: fields.error ?? null,
          intent: (fields.intent ?? undefined) as never,
          propertyIds: (fields.propertyIds ?? undefined) as never,
          latencyMs: Date.now() - started,
        },
      });
      return row.id;
    } catch {
      return null;
    }
  };

  try {
    // --- 3. This sender's WhatsApp conversation --------------------------
    // Scoped to channel "whatsapp": a person who also uses the website has two
    // separate histories on purpose, and one is never read into the other.
    let session = await prisma.chatSession.findFirst({
      where: { channel: "whatsapp", phone },
      orderBy: { updatedAt: "desc" },
    });
    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          channel: "whatsapp",
          phone,
          title: body.message.slice(0, 80),
        },
      });
    }

    // n8n sends no history: the app owns it and reads it here.
    const previousIntent =
      (body.previousIntent as SearchIntent | undefined) ??
      ((session.intent ?? undefined) as SearchIntent | undefined);

    // --- 4. Answer: the sales agent, else the deterministic search -------
    let reply: string;
    let intent: SearchIntent | null = null;
    let shownIds: string[] = [];
    let feature = "whatsapp_agent";
    let model: string | undefined;
    let tokens: { inputTokens?: number; outputTokens?: number } = {};

    const recent = await prisma.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_MESSAGES,
    });
    const history: AgentTurn[] = recent
      .reverse()
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .map((m) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
      }));

    const agent =
      process.env.AI_AGENT_ENABLED !== "false"
        ? await runSalesAgent({
            history,
            message: body.message,
            channel: "whatsapp",
            sessionId: session.id,
            phone,
          })
        : null;

    if (agent) {
      reply = agent.reply;
      intent = toSearchIntent(agent.lastSearch);
      shownIds = agent.propertyIds ?? [];
      model = agent.model;
      tokens = { inputTokens: agent.inputTokens, outputTokens: agent.outputTokens };
    } else {
      feature = "whatsapp_search";
      model = chatModel();
      // Merged intent drives the search, so "only waterfront" refines the last
      // one. The topic check must judge THIS message alone: the merged intent
      // always has fields set after any search, which made every later
      // message look like a property query ("what is the weather today").
      intent = await extractSearchIntent(body.message, previousIntent);
      const freshIntent = await extractSearchIntent(body.message);
      const onTopic =
        isRealEstateQuery(body.message, freshIntent) ||
        (Boolean(previousIntent) && CONTINUATION.test(body.message.trim()));

      if (!onTopic) {
        reply = OFF_TOPIC;
      } else {
        const results = await searchProperties(intent);
        const shown = results.slice(0, 5);
        shownIds = shown.map((p) => p.id);
        reply = shown.length
          ? [
              `I found ${results.length} matching properties. Here are the top ${shown.length}:`,
              "",
              ...shown.map(
                (p, i) =>
                  `${i + 1}. *${p.title}*` +
                  (p.community?.name ? `\n   ${p.community.name}` : "") +
                  `\n   from ${formatAED(p.priceAed)}`,
              ),
              "",
              "Reply to refine - for example \"only waterfront\" or \"under 3M\".",
            ].join("\n")
          : "I could not find anything matching that. Try widening the budget or the area.";
      }
    }

    reply = forWhatsApp(reply);

    // --- 5. Save the conversation ----------------------------------------
    // The app writes both sides, so n8n holds no state and needs no DB access.
    await prisma.message.create({
      data: { sessionId: session.id, role: "USER", content: body.message },
    });
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "ASSISTANT",
        content: reply,
        searchIntent: (intent ?? undefined) as never,
        propertyReferences: shownIds as never,
      },
    });
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        ...(intent ? { intent: intent as never } : {}),
        summary: reply.slice(0, 500),
      },
    });

    const logId = await log({
      status: "ok",
      reply,
      sessionId: session.id,
      intent,
      propertyIds: shownIds,
    });

    await logAiUsage({
      feature,
      model,
      status: "ok",
      latencyMs: Date.now() - started,
      sessionId: session.id,
      ...tokens,
    });

    return NextResponse.json({
      success: true,
      reply,
      session_id: session.id,
      log_id: logId,
    });
  } catch (error) {
    // The customer still gets a sentence, and the real cause travels back to
    // n8n in the same response AND lands in whatsapp_logs for later searching.
    const detail =
      error instanceof Error ? error.message : "WhatsApp chat failed";
    const logId = await log({
      status: "error",
      reply: FRIENDLY_ERROR,
      error: detail,
    });

    await logAiUsage({
      feature: "whatsapp_agent",
      status: "error",
      error: detail,
      latencyMs: Date.now() - started,
    });

    return NextResponse.json({
      success: false,
      reply: FRIENDLY_ERROR,
      error: detail,
      execution_id: executionId,
      log_id: logId,
    });
  }
}
