import { extractSearchIntentHeuristic } from "@/lib/ai/intent";
import { DEFAULT_PROMPTS } from "@/lib/ai/prompts";
import { searchProperties } from "@/lib/search/search-service";
import { formatAED } from "@/lib/utils";
import { failure } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
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
  previousIntent: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return failure("VALIDATION_ERROR", "No user message provided", 400);
    }

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

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const facts: string[] = [];
          if (!property) {
            facts.push(
              "I could not find this property in inventory. No facts are available.",
            );
          } else {
            facts.push(`Regarding **${property.title}**:`);
            facts.push(
              `- Price: ${formatAED(property.priceAed)} (known listing data)`,
            );
            facts.push(
              `- Specs: ${property.bedrooms ?? "—"} bed · ${property.bathrooms ?? "—"} bath · ${property.areaSqft ?? "—"} sqft`,
            );
            if (property.community) {
              facts.push(`- Community: ${property.community.name}`);
            }
            if (property.rentalYield != null) {
              facts.push(
                `- Rental yield on file: ${property.rentalYield}% (known data)`,
              );
            } else {
              facts.push("- Rental yield: not available in our records.");
            }
            if (property.reraStatus) {
              facts.push(`- RERA/approval: ${property.reraStatus}`);
            } else {
              facts.push("- RERA/approval status: not available.");
            }
            facts.push("");
            facts.push(DEFAULT_PROMPTS.propertyAssistant);
            facts.push("");
            facts.push(
              `Your question: “${lastUser.content}”. I can only answer from the facts above and linked knowledge.`,
            );
          }
          controller.enqueue(encoder.encode(facts.join("\n")));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    const intent = extractSearchIntentHeuristic(
      lastUser.content,
      (body.previousIntent as never) ?? null,
    );

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

    const encoder = new TextEncoder();
    const payload = summaryLines.join("\n");
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of payload.match(/.{1,24}/g) ?? [payload]) {
          controller.enqueue(encoder.encode(chunk));
          await new Promise((r) => setTimeout(r, 12));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Search-Intent": Buffer.from(JSON.stringify(intent)).toString(
          "base64url",
        ),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return failure(
      "CHAT_ERROR",
      error instanceof Error ? error.message : "Chat failed",
      500,
    );
  }
}
