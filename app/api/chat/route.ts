import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { extractSearchIntent, isRealEstateQuery } from "@/lib/ai/intent";
import { answerPropertyQuestion } from "@/lib/ai/property-answer";
import { buildMarketInsights } from "@/lib/property/market-insights";
import { getPrompts } from "@/lib/ai/get-prompt";
import { logAiUsage } from "@/lib/ai/usage";
import {
  streamGroundedResponse,
  gatherKnowledge,
  chatModel,
  type ChatTurn,
  type CompletionUsage,
} from "@/lib/ai/respond";
import { searchProperties } from "@/lib/search/search-service";
import { formatAED } from "@/lib/utils";
import { failure } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  SearchIntentSchema,
  type SearchIntent,
} from "@/lib/validation/search-intent";
import { z } from "zod";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ),
  sessionId: z.string().optional(),
  propertyId: z.string().optional(),
  previousIntent: SearchIntentSchema.partial().optional(),
});

/** Deterministic fallback "stream" (used when no LLM key is configured). */
function streamText(text: string, headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // [\s\S] so newlines are streamed too — a plain "." drops them.
      for (const chunk of text.match(/[\s\S]{1,32}/g) ?? [text]) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((r) => setTimeout(r, 8));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      ...headers,
    },
  });
}

const LLM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache",
};

export async function POST(request: Request) {
  const started = Date.now();
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limited = rateLimit(`chat:${ip}`, 60, 60_000);
  if (!limited.ok) {
    return failure("RATE_LIMITED", "Too many chat requests", 429);
  }

  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return failure("VALIDATION_ERROR", "No user message provided", 400);
    }

    // Generate the session id locally when the client didn't supply one, so the
    // response never waits on a DB insert just to learn the id. The row itself
    // is written off the critical path (see `persistTurn` below).
    const isNewSession = !body.sessionId;
    const chatSessionId = body.sessionId ?? randomUUID();

    // Writes the session row (if new) + the user's message, in FK order.
    const writeInbound = async () => {
      if (isNewSession) {
        await prisma.chatSession.create({
          data: { id: chatSessionId, title: lastUser.content.slice(0, 80) },
        });
      }
      await prisma.message.create({
        data: {
          sessionId: chatSessionId,
          role: "USER",
          content: lastUser.content,
        },
      });
    };

    // All transcript persistence runs AFTER the response has been streamed, so
    // DB-write latency never adds to the user's perceived response time. Each
    // turn schedules exactly one `after` callback that writes the inbound rows
    // then the assistant reply / logs, in order. Use this only from within the
    // request scope (not from a stream's onComplete, which runs after the
    // handler returns — there, await `writeInbound` + the writes directly).
    const persistTurn = (writes: () => Promise<void>): void => {
      after(async () => {
        try {
          await writeInbound();
          await writes();
        } catch {
          // Best-effort: a failed transcript write must not break the chat.
        }
      });
    };

    // Prior turns (exclude the current user message) for conversation continuity.
    const history: ChatTurn[] = body.messages
      .slice(0, -1)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // ---------------- Property assistant branch ----------------
    if (body.propertyId) {
      const prompts = await getPrompts(["system", "propertyAssistant"]);
      const property = await prisma.property.findFirst({
        where: { id: body.propertyId, deletedAt: null },
        include: {
          community: true,
          developer: true,
          amenities: { include: { amenity: true } },
          salesHistory: { orderBy: { soldAt: "desc" }, take: 5 },
          rentalHistory: { orderBy: { rentedAt: "desc" }, take: 5 },
        },
      });

      if (!property) {
        const answer =
          "I could not find this property in inventory, so I have no facts to share about it.";
        persistTurn(async () => {
          await prisma.message.create({
            data: {
              sessionId: chatSessionId,
              role: "ASSISTANT",
              content: answer,
            },
          });
        });
        return streamText(answer, { "X-Chat-Session": chatSessionId });
      }

      const factLines = [
        `Property: ${property.title}`,
        `Price: ${formatAED(property.priceAed)}`,
        `Specs: ${property.bedrooms ?? "—"} bed · ${property.bathrooms ?? "—"} bath · ${property.areaSqft ?? "—"} sqft`,
        property.community ? `Community: ${property.community.name}` : null,
        property.developer ? `Developer: ${property.developer.name}` : null,
        property.offPlan ? "Status: off-plan" : "Status: ready / completed",
        property.rentalYield != null
          ? `Rental yield on file: ${property.rentalYield}%`
          : "Rental yield: not available.",
        property.reraStatus
          ? `RERA/approval: ${property.reraStatus}`
          : "RERA/approval: not available.",
        property.amenities.length
          ? `Amenities: ${property.amenities.map((a) => a.amenity.name).join(", ")}`
          : "Amenities: not listed.",
        property.salesHistory.length
          ? `Recent sales: ${property.salesHistory
              .map(
                (s) =>
                  `${formatAED(s.priceAed)} (${s.soldAt.toISOString().slice(0, 10)})`,
              )
              .join("; ")}`
          : null,
      ].filter((l): l is string => Boolean(l));

      // Writes the assistant reply + usage log for this property turn.
      const writeAssistant = async (text: string, usage?: CompletionUsage) => {
        await prisma.message.create({
          data: {
            sessionId: chatSessionId,
            role: "ASSISTANT",
            content: text,
            propertyReferences: [property.id],
          },
        });
        await logAiUsage({
          feature: "property_assistant",
          model: chatModel(),
          status: "ok",
          latencyMs: Date.now() - started,
          sessionId: chatSessionId,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
        });
      };

      // In-scope persistence (direct answers / fallbacks): defer via `after`.
      const persist = (text: string, usage?: CompletionUsage) =>
        persistTurn(() => writeAssistant(text, usage));

      // Specific factual questions get a direct answer (fast, exact) instead of
      // the whole fact sheet. Open-ended questions fall through to the LLM.
      const insights = buildMarketInsights({
        id: property.id,
        title: property.title,
        priceAed: property.priceAed,
        areaSqft: property.areaSqft,
        community: property.community,
      });
      const direct = answerPropertyQuestion(
        lastUser.content,
        property,
        insights,
      );
      if (direct) {
        persist(direct);
        return streamText(direct, { "X-Chat-Session": chatSessionId });
      }

      // The LLM path needs retrieved knowledge; only fetch it when we get here.
      const knowledge = await gatherKnowledge(
        `${property.title} ${property.community?.name ?? ""} ${lastUser.content}`,
      );
      const context = `${factLines.join("\n")}${knowledge ? `\n\nCommunity / knowledge:\n${knowledge}` : ""}`;

      const stream = await streamGroundedResponse({
        system: `${prompts.system}\n${prompts.propertyAssistant}`,
        history,
        question: lastUser.content,
        context,
        // onComplete fires after the handler returns (during stream drain), so
        // it is outside the `after` scope — await the writes directly here.
        onComplete: async (text, usage) => {
          try {
            await writeInbound();
            await writeAssistant(text, usage);
          } catch {
            // Best-effort transcript write.
          }
        },
      });
      if (stream) {
        return new Response(stream, {
          headers: { ...LLM_HEADERS, "X-Chat-Session": chatSessionId },
        });
      }

      // Fallback: deterministic fact sheet.
      const answer = [
        `Regarding **${property.title}**:`,
        ...factLines.slice(1).map((l) => `- ${l}`),
        "",
        "I only answer from the facts above and retrieved knowledge.",
      ].join("\n");
      persist(answer);
      return streamText(answer, { "X-Chat-Session": chatSessionId });
    }

    // ---------------- Conversational search branch ----------------
    const previous = (body.previousIntent ?? undefined) as SearchIntent | undefined;
    const intent = await extractSearchIntent(lastUser.content, previous);

    // Decline off-topic questions instead of running a blind property search.
    if (!isRealEstateQuery(lastUser.content, intent)) {
      const answer =
        "I'm the DMProperties real-estate assistant, so I can only help with " +
        "properties, communities, projects and prices — I don't have an answer " +
        "for that. Try asking about villas, apartments, off-plan projects, or a " +
        "specific community like Palm Jumeirah.";
      persistTurn(async () => {
        await prisma.message.create({
          data: {
            sessionId: chatSessionId,
            role: "ASSISTANT",
            content: answer,
          },
        });
      });
      return streamText(answer, { "X-Chat-Session": chatSessionId });
    }

    let results: Awaited<ReturnType<typeof searchProperties>> = [];
    try {
      results = await searchProperties(intent);
    } catch {
      results = [];
    }
    const top = results.slice(0, 6);
    // The results grid mirrors every match (capped), so its count agrees with
    // the number reported in chat; the text summary still lists only `top`.
    const shown = results.slice(0, 24);

    const searchHeaders = {
      "X-Chat-Session": chatSessionId,
      "X-Search-Intent": Buffer.from(JSON.stringify(intent)).toString("base64url"),
      "X-Property-Ids": shown.map((p) => p.id).join(","),
    };

    // Search results use a deterministic, structured summary (no LLM call) —
    // instant, consistent formatting, and no dependency on model latency. The
    // LLM is still used for property-detail Q&A above.
    const criteria = [
      `Type: ${intent.propertyTypes?.length ? intent.propertyTypes.join("/") : (intent.propertyType ?? "any")}`,
      `Location: ${intent.community ?? intent.location ?? "any"}`,
      `Bedrooms: ${intent.bedroomsList?.length ? intent.bedroomsList.join(", ") : (intent.bedrooms ?? "any")}`,
      `Budget: ${
        intent.minPriceAED != null || intent.maxPriceAED != null
          ? `${intent.minPriceAED ? formatAED(intent.minPriceAED) : "any"} – ${intent.maxPriceAED ? formatAED(intent.maxPriceAED) : "any"}`
          : "any"
      }`,
      ...(intent.minAreaSqft != null || intent.maxAreaSqft != null
        ? [
            `Size: ${intent.minAreaSqft?.toLocaleString() ?? "0"}–${intent.maxAreaSqft?.toLocaleString() ?? "∞"} sqft`,
          ]
        : []),
      `Waterfront: ${intent.waterfront ? "yes" : "not required"}`,
    ].join(" · ");

    const answer = [
      "Here is what I understood from your request:",
      criteria,
      "",
      top.length
        ? `I found ${results.length} matching properties.`
        : "No matching properties were found in inventory for those filters. Try broadening location or budget.",
      ...(top.length ? ["Top results:"] : []),
      ...top.map(
        (p, i) =>
          `${i + 1}. ${p.title} — ${formatAED(p.priceAed)} · ${p.bedrooms ?? "—"} bed · score ${p.score}`,
      ),
      "",
      "You can refine with follow-ups like “only waterfront” or “under AED 25M”.",
    ].join("\n");

    // Persist the whole turn after the response streams — the client already
    // has its answer and results, so none of these writes block it.
    persistTurn(async () => {
      await prisma.chatSession.update({
        where: { id: chatSessionId },
        data: { intent, summary: answer.slice(0, 500) },
      });
      await prisma.message.create({
        data: {
          sessionId: chatSessionId,
          role: "ASSISTANT",
          content: answer,
          searchIntent: intent,
          propertyReferences: shown.map((p) => p.id),
        },
      });
      await prisma.searchHistory.create({
        data: { query: lastUser.content, intent },
      });
      await logAiUsage({
        feature: "conversational_search",
        model: chatModel(),
        status: "ok",
        latencyMs: Date.now() - started,
        sessionId: chatSessionId,
      });
    });

    return streamText(answer, searchHeaders);
  } catch (error) {
    await logAiUsage({
      feature: "chat",
      status: "error",
      error: error instanceof Error ? error.message : "Chat failed",
      latencyMs: Date.now() - started,
    });
    return failure(
      "CHAT_ERROR",
      error instanceof Error ? error.message : "Chat failed",
      500,
    );
  }
}
