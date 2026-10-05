import { prisma } from "@/lib/db/prisma";
import { logAiUsage } from "@/lib/ai/usage";
import { runSalesAgent, type AgentTurn } from "./run";
import type { SearchCriteria } from "./inventory";
import type { SearchIntent } from "@/lib/validation/search-intent";

/**
 * Separates the reply text from the end-of-turn metadata in the chat stream.
 * The agent decides which properties to show only after its tool calls, which
 * is too late for response headers, so the stream ends with
 *   <reply text> \u001e {"propertyIds":[...],"intent":{...}}
 * and the client strips everything from the separator on.
 */
export const META_SEPARATOR = "\u001e";

export type StreamMeta = {
  propertyIds?: string[];
  intent?: SearchIntent | null;
};

const TYPES = ["villa", "apartment", "penthouse", "townhouse", "unit", "land"] as const;

/** Map the agent's last search onto the classic intent shape, so the
 *  deterministic fallback can refine it on a later turn. */
export function toSearchIntent(c: SearchCriteria | null): SearchIntent | null {
  if (!c) return null;
  const types = (c.propertyTypes ?? []).filter((t): t is (typeof TYPES)[number] =>
    (TYPES as readonly string[]).includes(t),
  );
  return {
    community: c.locations?.[0],
    location: c.locations?.[0],
    developer: c.developer,
    propertyType: types[0],
    propertyTypes: types.length > 1 ? types : undefined,
    bedrooms: c.bedrooms?.length ? Math.min(...c.bedrooms) : c.minBedrooms,
    bedroomsList: c.bedrooms && c.bedrooms.length > 1 ? c.bedrooms : undefined,
    minPriceAED: c.minPriceAed,
    maxPriceAED: c.maxPriceAed,
    minAreaSqft: c.minSizeSqft,
    maxAreaSqft: c.maxSizeSqft,
    offPlan: c.completion === "off_plan" ? true : c.completion === "ready" ? false : undefined,
    dealType: c.dealType,
  };
}

/** Fallback turn: the pre-agent deterministic reply, rendered as text + meta. */
export type FallbackTurn = () => Promise<{ text: string; meta: StreamMeta }>;

/**
 * Streams one sales-agent turn. The response starts immediately (the agent's
 * tool rounds can take several seconds and hosts cap non-streaming functions
 * sooner than streaming ones); the text is written once the agent finishes,
 * followed by the metadata trailer. When the agent is unavailable the
 * deterministic reply is streamed instead, so the person always gets an answer.
 */
export function agentChatResponse(opts: {
  history: AgentTurn[];
  message: string;
  sessionId: string;
  isNewSession: boolean;
  userId: string | null;
  currentProperty: { id: string; title: string } | null;
  started: number;
  fallback: FallbackTurn;
}): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = async (text: string) => {
        // Small chunks so the reply appears progressively, like the old stream.
        for (const chunk of text.match(/[\s\S]{1,48}/g) ?? [text]) {
          controller.enqueue(encoder.encode(chunk));
          await new Promise((r) => setTimeout(r, 6));
        }
      };

      let result: Awaited<ReturnType<typeof runSalesAgent>> = null;
      let failure = "";
      try {
        result = await runSalesAgent({
          history: opts.history,
          message: opts.message,
          channel: "web",
          sessionId: opts.sessionId,
          currentProperty: opts.currentProperty,
          userId: opts.userId,
          onFailure: (reason) => {
            failure = reason;
          },
        });
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }

      if (!result) {
        // Visible in ai_logs: why this turn got the fallback reply.
        await logAiUsage({
          feature: "sales_agent",
          status: "error",
          error: (failure || "unknown").slice(0, 1000),
          latencyMs: Date.now() - opts.started,
          sessionId: opts.sessionId,
        });
      }

      if (!result) {
        try {
          const { text, meta } = await opts.fallback();
          await write(text);
          controller.enqueue(encoder.encode(META_SEPARATOR + JSON.stringify(meta)));
        } catch {
          await write("Sorry, I had trouble answering just now. Please try again in a moment.");
        }
        controller.close();
        return;
      }

      const intent = toSearchIntent(result.lastSearch);
      await write(result.reply);
      const meta: StreamMeta = {};
      if (result.propertyIds) meta.propertyIds = result.propertyIds;
      if (intent) meta.intent = intent;
      controller.enqueue(encoder.encode(META_SEPARATOR + JSON.stringify(meta)));

      // Transcript + usage, written before closing so a serverless host does
      // not freeze the function mid-write. The person already has the text.
      try {
        if (opts.isNewSession) {
          await prisma.chatSession.create({
            data: { id: opts.sessionId, userId: opts.userId, title: opts.message.slice(0, 80) },
          });
        }
        await prisma.message.create({
          data: { sessionId: opts.sessionId, role: "USER", content: opts.message },
        });
        await prisma.message.create({
          data: {
            sessionId: opts.sessionId,
            role: "ASSISTANT",
            content: result.reply,
            searchIntent: (intent ?? undefined) as never,
            propertyReferences: (result.propertyIds ??
              (opts.currentProperty ? [opts.currentProperty.id] : undefined)) as never,
          },
        });
        await prisma.chatSession.update({
          where: { id: opts.sessionId },
          data: {
            ...(intent ? { intent: intent as never } : {}),
            summary: result.reply.slice(0, 500),
          },
        });
        if (intent) {
          await prisma.searchHistory.create({ data: { query: opts.message, intent: intent as never } });
        }
        await logAiUsage({
          feature: "sales_agent",
          model: result.model,
          status: "ok",
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: Date.now() - opts.started,
          sessionId: opts.sessionId,
        });
      } catch {
        // Best-effort: a failed transcript write must not break the chat.
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Chat-Session": opts.sessionId,
      "X-Chat-Meta": "trailer",
    },
  });
}
