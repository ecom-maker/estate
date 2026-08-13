import { extractSearchIntent } from "@/lib/ai/intent";
import { DEFAULT_PROMPTS } from "@/lib/ai/prompts";
import { logAiUsage } from "@/lib/ai/usage";
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

function streamText(
  text: string,
  headers: Record<string, string> = {},
) {
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
        data: {
          title: lastUser.content.slice(0, 80),
        },
      });
      sessionId = session.id;
    }

    await prisma.message.create({
      data: {
        sessionId,
        role: "USER",
        content: lastUser.content,
      },
    });

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

      const facts: string[] = [];
      if (!property) {
        facts.push(
          "I could not find this property in inventory. No facts are available.",
        );
      } else {
        facts.push(`Regarding **${property.title}**:`);
        facts.push(`- Price: ${formatAED(property.priceAed)} (known listing data)`);
        facts.push(
          `- Specs: ${property.bedrooms ?? "—"} bed · ${property.bathrooms ?? "—"} bath · ${property.areaSqft ?? "—"} sqft`,
        );
        if (property.community) facts.push(`- Community: ${property.community.name}`);
        if (property.developer) facts.push(`- Developer: ${property.developer.name}`);
        if (property.rentalYield != null) {
          facts.push(`- Rental yield on file: ${property.rentalYield}% (known data)`);
        } else {
          facts.push("- Rental yield: not available in our records.");
        }
        if (property.reraStatus) {
          facts.push(`- RERA/approval: ${property.reraStatus}`);
        } else {
          facts.push("- RERA/approval status: not available.");
        }
        const amenityNames = property.amenities.map((a) => a.amenity.name);
        facts.push(
          amenityNames.length
            ? `- Amenities: ${amenityNames.join(", ")}`
            : "- Amenities: not listed.",
        );
        facts.push("");
        facts.push(DEFAULT_PROMPTS.propertyAssistant);
        facts.push("");
        facts.push(
          `Your question: “${lastUser.content}”. I only answer from the facts above and retrieved knowledge.`,
        );
      }

      const answer = facts.join("\n");
      await prisma.message.create({
        data: {
          sessionId,
          role: "ASSISTANT",
          content: answer,
          propertyReferences: property ? [property.id] : [],
        },
      });
      await logAiUsage({
        feature: "property_assistant",
        status: "ok",
        latencyMs: Date.now() - started,
        sessionId,
      });

      return streamText(answer, { "X-Chat-Session": sessionId });
    }

    const previous = (body.previousIntent ?? undefined) as SearchIntent | undefined;
    const intent = await extractSearchIntent(lastUser.content, previous);
    let results: Awaited<ReturnType<typeof searchProperties>> = [];
    try {
      results = await searchProperties(intent);
    } catch {
      results = [];
    }

    const top = results.slice(0, 6);
    const summaryLines = [
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
    ];
    const answer = summaryLines.join("\n");

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { intent, summary: answer.slice(0, 500) },
    });
    await prisma.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: answer,
        searchIntent: intent,
        propertyReferences: top.map((p) => p.id),
      },
    });
    await prisma.searchHistory.create({
      data: {
        query: lastUser.content,
        intent,
      },
    });
    await logAiUsage({
      feature: "conversational_search",
      status: "ok",
      latencyMs: Date.now() - started,
      sessionId,
    });

    return streamText(answer, {
      "X-Chat-Session": sessionId,
      "X-Search-Intent": Buffer.from(JSON.stringify(intent)).toString("base64url"),
      "X-Property-Ids": top.map((p) => p.id).join(","),
    });
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
