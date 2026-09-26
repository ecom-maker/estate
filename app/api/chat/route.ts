import { extractSearchIntent } from "@/lib/ai/intent";
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
      for (const chunk of text.match(/.{1,32}/g) ?? [text]) {
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

    let sessionId = body.sessionId;
    if (!sessionId) {
      const session = await prisma.chatSession.create({
        data: { title: lastUser.content.slice(0, 80) },
      });
      sessionId = session.id;
    }
    const chatSessionId = sessionId;

    await prisma.message.create({
      data: { sessionId: chatSessionId, role: "USER", content: lastUser.content },
    });

    const prompts = await getPrompts(["system", "search", "propertyAssistant"]);

    // Prior turns (exclude the current user message) for conversation continuity.
    const history: ChatTurn[] = body.messages
      .slice(0, -1)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // ---------------- Property assistant branch ----------------
    if (body.propertyId) {
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
        await prisma.message.create({
          data: { sessionId: chatSessionId, role: "ASSISTANT", content: answer },
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

      const knowledge = await gatherKnowledge(
        `${property.title} ${property.community?.name ?? ""} ${lastUser.content}`,
      );
      const context = `${factLines.join("\n")}${knowledge ? `\n\nCommunity / knowledge:\n${knowledge}` : ""}`;

      const persist = async (text: string, usage?: CompletionUsage) => {
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

      const stream = await streamGroundedResponse({
        system: `${prompts.system}\n${prompts.propertyAssistant}`,
        history,
        question: lastUser.content,
        context,
        onComplete: persist,
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
      await persist(answer);
      return streamText(answer, { "X-Chat-Session": chatSessionId });
    }

    // ---------------- Conversational search branch ----------------
    const previous = (body.previousIntent ?? undefined) as SearchIntent | undefined;
    const intent = await extractSearchIntent(lastUser.content, previous);
    let results: Awaited<ReturnType<typeof searchProperties>> = [];
    try {
      results = await searchProperties(intent);
    } catch {
      results = [];
    }
    const top = results.slice(0, 6);

    const intentSummary = [
      `Type: ${intent.propertyType ?? "any"}`,
      `Deal: ${intent.dealType === "rent" ? "for rent" : intent.dealType === "sale" ? "for sale" : "any"}`,
      `Location: ${intent.community ?? intent.location ?? "any"}`,
      `Bedrooms: ${intent.bedrooms ?? "any"}`,
      `Max budget: ${intent.maxPriceAED ? formatAED(intent.maxPriceAED) : "any"}`,
      `Waterfront: ${intent.waterfront ? "yes" : "not required"}`,
    ].join("\n");

    const resultsBlock = top.length
      ? top
          .map(
            (p, i) =>
              `${i + 1}. ${p.title} — ${formatAED(p.priceAed)} · ${p.bedrooms ?? "—"} bed · ${p.bathrooms ?? "—"} bath · ${p.areaSqft ?? "—"} sqft · ${p.community?.name ?? "—"} · ${p.offPlan ? "off-plan" : "ready"} · match score ${p.score}`,
          )
          .join("\n")
      : "No matching properties in inventory for these filters.";

    const knowledge = await gatherKnowledge(lastUser.content);
    const context = `Interpreted search intent:\n${intentSummary}\n\nMatching inventory (${results.length} total; top ${top.length} shown):\n${resultsBlock}${knowledge ? `\n\nKnowledge:\n${knowledge}` : ""}`;

    const searchHeaders = {
      "X-Chat-Session": chatSessionId,
      "X-Search-Intent": Buffer.from(JSON.stringify(intent)).toString("base64url"),
      "X-Property-Ids": top.map((p) => p.id).join(","),
    };

    const persistSearch = async (text: string, usage?: CompletionUsage) => {
      await prisma.chatSession.update({
        where: { id: chatSessionId },
        data: { intent, summary: text.slice(0, 500) },
      });
      await prisma.message.create({
        data: {
          sessionId: chatSessionId,
          role: "ASSISTANT",
          content: text,
          searchIntent: intent,
          propertyReferences: top.map((p) => p.id),
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
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
      });
    };

    const stream = await streamGroundedResponse({
      system: `${prompts.system}\n${prompts.search}`,
      history,
      question: lastUser.content,
      context,
      onComplete: persistSearch,
    });
    if (stream) {
      return new Response(stream, {
        headers: { ...LLM_HEADERS, ...searchHeaders },
      });
    }

    // Fallback: deterministic summary.
    const answer = [
      "Here is what I understood from your request:",
      `- Type: ${intent.propertyType ?? "any"}`,
      `- Location: ${intent.community ?? intent.location ?? "any"}`,
      `- Bedrooms: ${intent.bedrooms ?? "any"}`,
      `- Max budget: ${intent.maxPriceAED ? formatAED(intent.maxPriceAED) : "any"}`,
      `- Waterfront: ${intent.waterfront ? "yes" : "not required"}`,
      "",
      top.length
        ? `I found ${results.length} matching properties. Top results:`
        : "No matching properties were found in inventory for those filters. Try broadening location or budget.",
      ...top.map(
        (p, i) =>
          `${i + 1}. ${p.title} — ${formatAED(p.priceAed)} · ${p.bedrooms ?? "—"} bed · score ${p.score}`,
      ),
      "",
      "You can refine with follow-ups like “only waterfront” or “under AED 25M”.",
    ].join("\n");
    await persistSearch(answer);
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
